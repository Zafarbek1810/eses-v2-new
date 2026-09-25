import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Search, RefreshCw, FileBarChart2, X, Loader2, CheckCircle, AlertCircle,
  ArrowLeft, Save, FileText, Lock, Download, ZoomIn, ZoomOut, Printer, Eye, QrCode,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, User, Building2,
} from "lucide-react";
import {
  getOrdersFull,
  getAllOrders,
  getOrderById,
  resolveOrderItemAnalysisId,
  resolveOrderType,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import {
  addResult,
  buildResultItemFromGrid,
  decodeGridFillFromItems,
  findResultByOrderId,
  getAllResults,
  getResultById,
  getResultItems,
  GRID_TEMPLATE_ID_KEY,
  GRID_OVERLAYS_KEY,
  resolveResultItemAnalysisId,
  updateResult,
  type ResultRecord,
} from "@/api/result";
import { getStoredUser } from "@/api/auth";
import { getStoredCompanyId } from "@/api/session";
import { getAllLaboratories } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { normalizeRoleName } from "@/lib/roles";
import {
  matchesLabScope,
  resolveUserLabScope,
  type LabScope,
} from "@/lib/labScope";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import {
  ReceiptModal,
  buildReceiptQrLinks,
  type ReceiptCartItem,
  type ReceiptPatient,
  type ResultQrLink,
} from "@/components/ReceiptModal";
import { downloadElementAsPdf, printElementAsPdf } from "@/lib/pdfExport";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  fetchPdfTemplatesForAnalyses,
  getPdfPreviewHeight,
  getPdfPreviewWidth,
  hydratePdfTemplateImages,
  listPdfTemplatesForAnalysis,
  normalizeTableData,
  resolvePdfTemplateAnalysisId,
  resolveStoredCompanyDynamic,
  seedDynamicFillFromTemplate,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const PER_PAGE = 10;

type ResultsOrderTab = "patient" | "sample";

const RESULTS_ORDER_TABS: { id: ResultsOrderTab; label: string; icon: typeof User }[] = [
  { id: "patient", label: "Bemor uchun", icon: User },
  { id: "sample", label: "Tashkilot uchun", icon: Building2 },
];

function matchesResultsOrderTab(orderType: string, tab: ResultsOrderTab) {
  const t = orderType.trim().toLowerCase();
  const isSample = t === "sample" || t === "organization" || t === "org" || t === "tashkilot";
  return tab === "sample" ? isSample : !isSample;
}

type ReceiptView = {
  patient: ReceiptPatient;
  items: ReceiptCartItem[];
  paymentMethod: string;
  paidAmount: number;
  discountPercent: number | null;
  totalBeforeDiscount: number;
  resultLinks: ResultQrLink[];
  initialAnalysisId: number;
};

function parseMoney(raw: string | number | undefined | null): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function orderItemPrice(item: OrderItem): number {
  const extra = item as OrderItem & { price?: string | number };
  return parseMoney(item.analysis?.price ?? extra.price);
}

const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 2;
const PDF_ZOOM_STEP = 0.1;
const PDF_ZOOM_DEFAULT = 1;

type OrderAnalysisRow = {
  key: string;
  orderId: number;
  orderItemId: number;
  analysisId: number;
  analysisName: string;
  laboratoryName: string;
  laboratoryId: number | null;
  itemStatus: string;
  patientName: string;
  orderType: string;
  orderCreatedAt?: string;
  resultId: number | null;
  hasSavedValues: boolean;
};

function patientNameFromOrder(patient: OrderPatient | null | undefined, fallback?: string | null) {
  if (!patient) return fallback?.trim() || "—";
  return `${patient.last_name ?? ""} ${patient.first_name ?? ""}`.trim() || "—";
}

function statusBadgeClass(status?: string) {
  switch (status) {
    case "completed":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "pending":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "in_progress":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-400";
    case "canceled":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

function filterRowsByLabScope(
  rows: OrderAnalysisRow[],
  scope: LabScope,
): OrderAnalysisRow[] {
  if (scope.labIds.size === 0 && scope.analysisIds.size === 0) return [];
  return rows.filter(r => matchesLabScope(r.laboratoryId, r.analysisId, scope));
}

function flattenOrderAnalyses(
  orders: Order[],
  results: ResultRecord[],
): OrderAnalysisRow[] {
  const rows: OrderAnalysisRow[] = [];
  for (const order of orders) {
    const existing = findResultByOrderId(results, order.id);
    const savedItems = existing ? getResultItems(existing) : [];
    const orderItems = (order.items ?? []) as OrderItem[];
    for (const item of orderItems) {
      const analysisId = resolveOrderItemAnalysisId(item);
      if (!analysisId) continue;
      const savedForAnalysis = savedItems.some(
        ri => resolveResultItemAnalysisId(ri) === analysisId,
      );
      rows.push({
        key: `${order.id}-${item.id}`,
        orderId: order.id,
        orderItemId: item.id,
        analysisId,
        analysisName: item.analysis?.name ?? `Analiz #${analysisId}`,
        laboratoryName: item.laboratory?.name ?? "—",
        laboratoryId: item.laboratory?.id ?? null,
        itemStatus: String(item.status || "pending"),
        patientName: patientNameFromOrder(order.patient, order.name),
        orderType: resolveOrderType(order),
        orderCreatedAt: item.createdAt || order.createdAt,
        resultId: existing?.id ?? null,
        hasSavedValues: savedForAnalysis,
      });
    }
  }
  rows.sort((a, b) => {
    const ta = a.orderCreatedAt ? Date.parse(a.orderCreatedAt) : 0;
    const tb = b.orderCreatedAt ? Date.parse(b.orderCreatedAt) : 0;
    return tb - ta;
  });
  return rows;
}

function buildAddress(order: Order, patient: OrderPatient | null | undefined) {
  const parts = [
    patient?.village || order.village,
    patient?.street || order.street,
    order.district?.name,
  ].filter(Boolean);
  return parts.join(", ") || "—";
}

function buildDynamicContext(
  row: OrderAnalysisRow,
  order: Order | null,
  result: ResultRecord | null,
  company?: PdfDynamicContext,
): PdfDynamicContext {
  const patient = order?.patient;
  const user = getStoredUser();
  const shortName = user
    ? `${(user.username || "").charAt(0).toUpperCase()}.${user.surname || ""}`.replace(/^\./, "").replace(/\.$/, "") ||
    null
    : null;
  const role = normalizeRoleName(user?.role?.name);
  const isAssistant = role === "lab_asistant";

  return {
    orderId: row.orderId,
    orderCreatedAt: order?.createdAt || row.orderCreatedAt || null,
    resultId: result?.id ?? row.resultId ?? null,
    resultDate: result?.updatedAt || result?.createdAt || new Date().toISOString(),
    patientFullName: patientNameFromOrder(patient, order?.name),
    patientAddress: order ? buildAddress(order, patient) : null,
    patientBirthDay: patient?.birth_day ?? null,
    patientRegisteredAt: patient?.createdAt ?? null,
    patientPhone: patient?.phone ?? null,
    labDoctor: isAssistant ? null : shortName,
    labAssistant: isAssistant ? shortName : null,
    companyName: company?.companyName ?? null,
    analysisName: row.analysisName,
    laboratoryName: row.laboratoryName !== "—" ? row.laboratoryName : null,
    companyRegion: company?.companyRegion ?? null,
    companyDistrict: company?.companyDistrict ?? null,
    companyAddress: company?.companyAddress ?? null,
    companyPhone: company?.companyPhone ?? null,
    companyFax: company?.companyFax ?? null,
    companyWebsite: company?.companyWebsite ?? null,
    companyTelegram: company?.companyTelegram ?? null,
  };
}

function bindTemplateToAnalysis(
  base: PdfTemplate,
  analysisId: number,
  analysisName: string,
): PdfTemplate {
  const cloned = structuredClone(base) as PdfTemplate;
  const table = cloned.elements.find(el => el.type === "table");
  if (table) {
    table.analysisId = analysisId;
    table.analysisName = analysisName;
  }
  return cloned;
}

function templateMatchesId(template: PdfTemplate, preferredId?: string | null) {
  if (!preferredId) return false;
  const raw = String(preferredId).trim();
  if (!raw) return false;
  if (template.id === raw) return true;
  const storageId = String(template.storageId ?? "");
  if (storageId && (storageId === raw || template.id === `storage-${raw}` || raw === `storage-${storageId}`)) {
    return true;
  }
  return false;
}

let laboratoriesCache: Awaited<ReturnType<typeof getAllLaboratories>> | null = null;

function analysisIdsFromLab(lab: { analysis?: unknown[] } | null | undefined): number[] {
  const ids: number[] = [];
  for (const raw of lab?.analysis ?? []) {
    const id = Number(
      raw && typeof raw === "object" && "id" in raw ? (raw as { id?: unknown }).id : NaN,
    );
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  return ids;
}

function templatesNamed(list: PdfTemplate[], name: string): PdfTemplate[] {
  if (!name) return [];
  return list.filter(template => (template.analysisName || "").trim().toLowerCase() === name);
}

/** Shu analiz (va shu laboratoriya) ga tegishli PDF shablonlar. Boshqa analiz shabloniga tushmaydi. */
async function templatesForAnalysisRow(
  row: OrderAnalysisRow,
  all: PdfTemplate[],
): Promise<PdfTemplate[]> {
  const exact = listPdfTemplatesForAnalysis(row.analysisId, all);
  if (exact.length > 0) return exact;

  const name = row.analysisName.trim().toLowerCase();
  const byName = templatesNamed(all, name);
  if (byName.length > 0) return byName;

  if (row.laboratoryId == null) return [];
  try {
    if (!laboratoriesCache) laboratoriesCache = await getAllLaboratories();
    const labs = laboratoriesCache;
    const lab = (Array.isArray(labs) ? labs : []).find(item => item.id === row.laboratoryId);
    const ids = new Set(analysisIdsFromLab(lab));
    if (ids.size === 0) return [];
    return all.filter(template => {
      const id = resolvePdfTemplateAnalysisId(template);
      return id != null && ids.has(id);
    });
  } catch {
    return [];
  }
}

function pickTemplateForAnalysis(
  list: PdfTemplate[],
  preferredId?: string | null,
): PdfTemplate | null {
  const preferred = preferredId ? list.find(template => templateMatchesId(template, preferredId)) : null;
  if (preferred) return preferred;
  return list[0] ?? null;
}

function seedFillFromTemplate(
  tpl: PdfTemplate | null,
  saved: Record<string, string> = {},
): Record<string, string> {
  const next = seedDynamicFillFromTemplate(tpl, saved);
  const tplId = saved[GRID_TEMPLATE_ID_KEY];
  if (tplId) next[GRID_TEMPLATE_ID_KEY] = tplId;
  const overlays = saved[GRID_OVERLAYS_KEY];
  if (overlays) next[GRID_OVERLAYS_KEY] = overlays;
  return next;
}

/** Yozuvlar faqat saqlangan shablonga tegishli. Boshqa PDF ga ko'chmaydi. */
function fillsForTemplate(
  tpl: PdfTemplate,
  saved: Record<string, string>,
  templateCount: number,
): Record<string, string> {
  const savedId = saved[GRID_TEMPLATE_ID_KEY];
  const belongsHere = savedId
    ? templateMatchesId(tpl, savedId)
    : templateCount <= 1;
  if (!belongsHere) return { [GRID_TEMPLATE_ID_KEY]: tpl.id };
  const next = seedFillFromTemplate(tpl, saved);
  next[GRID_TEMPLATE_ID_KEY] = tpl.id;
  return next;
}

export function ResultsPage({ primaryColor }: { primaryColor: string }) {
  const role = normalizeRoleName(getStoredUser()?.role?.name);
  const isKassir = role === "kassir";
  const isKassirSangig = role === "kassir_sangig";
  const canEditResults = !isKassir;
  const restrictToOwnLab = role === "lab_director" || role === "lab_asistant";
  const showOrderTypeTabs = isKassir;

  const [rows, setRows] = useState<OrderAnalysisRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [resultsCache, setResultsCache] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [orderTypeTab, setOrderTypeTab] = useState<ResultsOrderTab>("patient");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const [selected, setSelected] = useState<OrderAnalysisRow | null>(null);
  const [qrLoadingKey, setQrLoadingKey] = useState<string | null>(null);
  const [receiptView, setReceiptView] = useState<ReceiptView | null>(null);
  const [template, setTemplate] = useState<PdfTemplate | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<PdfTemplate[]>([]);
  const [fillValues, setFillValues] = useState<Record<string, string>>({});
  const [dynamicCtx, setDynamicCtx] = useState<PdfDynamicContext | null>(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [opening, setOpening] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(PDF_ZOOM_DEFAULT);
  const pdfRef = useRef<HTMLDivElement>(null);
  const savedFillRef = useRef<Record<string, string>>({});
  const templatesCacheRef = useRef<PdfTemplate[] | null>(null);
  const labScopeRef = useRef<LabScope | null>(null);
  const [labScopeReady, setLabScopeReady] = useState(!restrictToOwnLab);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  useEffect(() => {
    if (!restrictToOwnLab) {
      labScopeRef.current = null;
      setLabScopeReady(true);
      return;
    }

    let cancelled = false;
    setLabScopeReady(false);

    void (async () => {
      const userId = getStoredUser()?.id;
      if (!userId) {
        if (!cancelled) {
          labScopeRef.current = { labIds: new Set(), analysisIds: new Set() };
          setLabScopeReady(true);
        }
        return;
      }
      try {
        const labs = await getAllLaboratories();
        if (cancelled) return;
        labScopeRef.current = resolveUserLabScope(
          Array.isArray(labs) ? labs : [],
          userId,
        );
      } catch {
        if (!cancelled) {
          labScopeRef.current = { labIds: new Set(), analysisIds: new Set() };
        }
      } finally {
        if (!cancelled) setLabScopeReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restrictToOwnLab]);

  const load = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    try {
      const scope = restrictToOwnLab ? labScopeRef.current : null;
      if (restrictToOwnLab && (!scope || scope.labIds.size === 0)) {
        setResultsCache([]);
        setOrders([]);
        setRows([]);
        setTotal(0);
        return;
      }

      const results = await getAllResults().catch(() => [] as ResultRecord[]);

      // Backend /order/getfull/labid?lab_id=... 500 — lab filtri clientda
      // Kassir / SAN GIG: order_type tablari uchun to'liq ro'yxat kerak
      if (scope || isKassir || isKassirSangig) {
        const all = await getAllOrders().catch(async () => {
          const res = await getOrdersFull({ page: 1, limit: 500, search: s.trim() || undefined });
          return res.data;
        });
        let list = Array.isArray(all) ? all : [];
        const missingItems = list.length > 0 && list.every(o => !(o.items && o.items.length));
        if (missingItems) {
          try {
            const res = await getOrdersFull({ page: 1, limit: 500, search: s.trim() || undefined });
            if (Array.isArray(res.data) && res.data.length > 0) list = res.data;
          } catch {
            /* getall itemsiz qolsa ham davom etamiz */
          }
        }
        let nextRows = flattenOrderAnalyses(list, results);
        if (scope) nextRows = filterRowsByLabScope(nextRows, scope);
        if (isKassirSangig) {
          nextRows = nextRows.filter(r => matchesResultsOrderTab(r.orderType, "sample"));
        } else if (isKassir) {
          nextRows = nextRows.filter(r => matchesResultsOrderTab(r.orderType, orderTypeTab));
        }

        const q = s.trim().toLowerCase();
        if (q) {
          nextRows = nextRows.filter(r => {
            const hay = [
              String(r.orderId),
              r.patientName,
              r.analysisName,
              r.laboratoryName,
              r.itemStatus,
            ]
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          });
        }

        const totalCount = nextRows.length;
        const totalPagesCount = Math.max(1, Math.ceil(totalCount / PER_PAGE));
        const safePage = Math.min(Math.max(1, p), totalPagesCount);
        const start = (safePage - 1) * PER_PAGE;

        setResultsCache(results);
        setOrders(list);
        setRows(nextRows.slice(start, start + PER_PAGE));
        setTotal(totalCount);
        setPage(safePage);
        return;
      }

      const ordersRes = await getOrdersFull({
        page: p,
        limit: PER_PAGE,
        search: s.trim() || undefined,
      });
      const list = Array.isArray(ordersRes.data) ? ordersRes.data : [];
      setResultsCache(results);
      setOrders(list);
      setRows(flattenOrderAnalyses(list, results));
      setTotal(ordersRes.total);
      setPage(ordersRes.page);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
      setRows([]);
      setOrders([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!labScopeReady) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, labScopeReady, orderTypeTab]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const goPage = (next: number) => {
    const p = Math.min(totalPages, Math.max(1, next));
    setPage(p);
  };

  const fetchResultTemplates = async (analysisIds: number[]) => {
    const companyId = getStoredCompanyId() ?? undefined;
    const cached = templatesCacheRef.current ?? [];
    const missing = analysisIds.filter(
      id => !cached.some(template => resolvePdfTemplateAnalysisId(template) === id),
    );
    const fetched = missing.length > 0
      ? await fetchPdfTemplatesForAnalyses(missing, companyId, { hydrateImages: false }).catch(
        () => [] as PdfTemplate[],
      )
      : [];
    const list = [...cached, ...fetched];
    templatesCacheRef.current = list;
    return list;
  };

  const loadResultTemplates = async (row: OrderAnalysisRow) => {
    return fetchResultTemplates([row.analysisId]);
  };

  const openRow = async (row: OrderAnalysisRow) => {
    setOpening(true);
    setSelected(row);
    setPdfZoom(PDF_ZOOM_DEFAULT);
    try {
      const cachedOrder = orders.find(o => o.id === row.orderId) ?? null;
      const cachedRec = findResultByOrderId(resultsCache, row.orderId);
      const cachedItems = cachedRec ? getResultItems(cachedRec) : [];
      const cachedFill = decodeGridFillFromItems(cachedItems, row.analysisId);
      const cacheHasGrid = Object.keys(cachedFill).length > 0;

      const resultPromise = (async () => {
        if (cacheHasGrid) return { rec: cachedRec, items: cachedItems };
        if (row.resultId) {
          try {
            const rec = await getResultById(row.resultId);
            const items = getResultItems(rec);
            if (items.length > 0) return { rec, items };
          } catch {
            /* ro'yxatdagi natija yetarli */
          }
        }
        return { rec: cachedRec, items: cachedItems };
      })();

      const [allTemplates, order, company, resultPack] = await Promise.all([
        loadResultTemplates(row),
        cachedOrder?.patient
          ? Promise.resolve(cachedOrder)
          : getOrderById(row.orderId).catch(() => cachedOrder),
        resolveStoredCompanyDynamic(),
        resultPromise,
      ]);

      const resultRec = resultPack.rec;
      const savedItems = resultPack.items;
      let analysisTemplates = await templatesForAnalysisRow(row, allTemplates);

      const saved = decodeGridFillFromItems(savedItems, row.analysisId);
      savedFillRef.current = saved;
      const savedTemplateId = saved[GRID_TEMPLATE_ID_KEY];
      const savedFromAll = savedTemplateId
        ? allTemplates.find(template => templateMatchesId(template, savedTemplateId))
        : null;
      if (savedFromAll && !analysisTemplates.some(template => template.id === savedFromAll.id)) {
        analysisTemplates = [savedFromAll, ...analysisTemplates];
      }
      setAvailableTemplates(analysisTemplates);

      const picked = pickTemplateForAnalysis(analysisTemplates, savedTemplateId);
      let tpl = picked
        ? bindTemplateToAnalysis(picked, row.analysisId, row.analysisName)
        : null;
      if (tpl) {
        try {
          const hydrated = await hydratePdfTemplateImages(tpl);
          tpl = bindTemplateToAnalysis(hydrated, row.analysisId, row.analysisName);
        } catch {
          /* rasm yuklanmasa ham shablon va yozuvlar ochilsin */
        }
      }
      setTemplate(tpl);

      setDynamicCtx(buildDynamicContext(row, order, resultRec, company));
      setFillValues(tpl ? fillsForTemplate(tpl, saved, analysisTemplates.length) : {});

      if (analysisTemplates.length === 0) {
        pushToast(
          "Bu analiz uchun PDF shablon topilmadi. Boshqaruv → PDF shablonida yarating.",
          "error",
        );
      }
    } finally {
      setOpening(false);
    }
  };

  const closeDetail = () => {
    setSelected(null);
    setTemplate(null);
    setAvailableTemplates([]);
    setFillValues({});
    setDynamicCtx(null);
    savedFillRef.current = {};
    setPdfZoom(PDF_ZOOM_DEFAULT);
  };

  const openReceiptQr = async (
    event: React.MouseEvent,
    row: OrderAnalysisRow,
  ) => {
    event.stopPropagation();
    if (qrLoadingKey) return;
    setQrLoadingKey(row.key);
    try {
      let order = orders.find(o => o.id === row.orderId) ?? null;
      if (!order?.items?.length) {
        try {
          order = await getOrderById(row.orderId);
        } catch {
          /* list dagi order yetarli bo'lishi mumkin */
        }
      }
      if (!order) {
        pushToast("Buyurtma topilmadi", "error");
        return;
      }

      const orderItems = (order.items ?? []) as OrderItem[];
      const scope = restrictToOwnLab ? labScopeRef.current : null;
      const cartItems: ReceiptCartItem[] = orderItems
        .map(item => {
          const analysisId = resolveOrderItemAnalysisId(item);
          if (!analysisId) return null;
          if (scope) {
            const labId = item.laboratory?.id ?? null;
            const inLab = labId != null && scope.labIds.has(labId);
            const inAnalysis = scope.analysisIds.has(analysisId);
            if (!inLab && !inAnalysis) return null;
          }
          return {
            key: `${order.id}-${item.id}`,
            analysis_id: analysisId,
            analysis_name: item.analysis?.name ?? `Analiz #${analysisId}`,
            laboratory_name: item.laboratory?.name ?? "—",
            price: orderItemPrice(item),
          };
        })
        .filter((item): item is ReceiptCartItem => item != null);

      const items =
        cartItems.length > 0
          ? cartItems
          : [
            {
              key: row.key,
              analysis_id: row.analysisId,
              analysis_name: row.analysisName,
              laboratory_name: row.laboratoryName,
              price: 0,
            },
          ];

      const templates = await fetchResultTemplates(items.map(item => item.analysis_id));

      const totalBeforeDiscount =
        parseMoney(order.total_amount) || items.reduce((sum, i) => sum + i.price, 0);
      const discountAmount = parseMoney(order.discount_amount);
      const paidAmount =
        parseMoney(order.final_amount) || Math.max(0, totalBeforeDiscount - discountAmount);
      const discountPercent =
        totalBeforeDiscount > 0 && discountAmount > 0
          ? Math.round((discountAmount / totalBeforeDiscount) * 100)
          : null;

      const patient: ReceiptPatient = order.patient
        ? {
          first_name: order.patient.first_name,
          last_name: order.patient.last_name,
          phone: order.patient.phone ?? null,
        }
        : {
          first_name: row.patientName,
          last_name: "",
          phone: null,
        };

      setReceiptView({
        patient,
        items,
        paymentMethod: String(order.payment_method || ""),
        paidAmount,
        discountPercent,
        totalBeforeDiscount,
        resultLinks: buildReceiptQrLinks(order.id, items, templates),
        initialAnalysisId: row.analysisId,
      });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "QR kod ochib bo'lmadi", "error");
    } finally {
      setQrLoadingKey(null);
    }
  };

  const zoomIn = () =>
    setPdfZoom(z => Math.min(PDF_ZOOM_MAX, Math.round((z + PDF_ZOOM_STEP) * 10) / 10));
  const zoomOut = () =>
    setPdfZoom(z => Math.max(PDF_ZOOM_MIN, Math.round((z - PDF_ZOOM_STEP) * 10) / 10));
  const zoomReset = () => setPdfZoom(PDF_ZOOM_DEFAULT);

  const handleTemplateChange = (templateId: string) => {
    if (!selected) return;
    const base = availableTemplates.find(t => t.id === templateId);
    if (!base) return;
    const analysisId = selected.analysisId;
    const analysisName = selected.analysisName;
    const apply = (source: PdfTemplate) => {
      const next = bindTemplateToAnalysis(source, analysisId, analysisName);
      setTemplate(next);
      setPdfZoom(PDF_ZOOM_DEFAULT);
      setFillValues(fillsForTemplate(next, savedFillRef.current, availableTemplates.length));
    };
    apply(base);
    void hydratePdfTemplateImages(base).then(apply).catch(() => undefined);
  };

  const updateFill = (key: string, value: string) => {
    if (!canEditResults) return;
    setFillValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveValues = async (): Promise<boolean> => {
    if (!canEditResults) {
      pushToast("Kassir natijani o'zgartira olmaydi", "error");
      return false;
    }
    if (!selected) return false;
    const user = getStoredUser();
    if (!user?.id) {
      pushToast("Foydalanuvchi topilmadi — qayta kiring", "error");
      return false;
    }

    setSaving(true);
    try {
      const newItem = buildResultItemFromGrid(selected.analysisId, fillValues);

      let existing: ResultRecord | null = null;
      if (selected.resultId) {
        try {
          existing = await getResultById(selected.resultId);
        } catch {
          existing = findResultByOrderId(resultsCache, selected.orderId);
        }
      } else {
        existing = findResultByOrderId(resultsCache, selected.orderId);
      }

      const otherItems = existing
        ? getResultItems(existing).filter(
          ri => resolveResultItemAnalysisId(ri) !== selected.analysisId,
        )
        : [];

      const payload = {
        order_id: selected.orderId,
        lab_director_id: user.id,
        result_item: [...otherItems, newItem],
      };

      let saved: ResultRecord;
      if (existing?.id) {
        saved = await updateResult(existing.id, payload);
      } else {
        saved = await addResult(payload);
      }

      // Always keep the items we just saved in cache (API may omit nested items)
      const cached: ResultRecord = {
        ...saved,
        id: saved.id || existing?.id || 0,
        order_id: selected.orderId,
        result_item:
          getResultItems(saved).length > 0 ? getResultItems(saved) : payload.result_item,
      };

      const savedId = cached.id;
      setResultsCache(list => {
        const without = list.filter(
          r => r.id !== savedId && findResultByOrderId([r], selected.orderId) == null,
        );
        return [...without, cached];
      });
      setRows(list =>
        list.map(r =>
          r.orderId === selected.orderId
            ? {
              ...r,
              resultId: savedId,
              hasSavedValues: r.analysisId === selected.analysisId ? true : r.hasSavedValues,
            }
            : r,
        ),
      );
      setSelected(s =>
        s
          ? { ...s, resultId: savedId, hasSavedValues: true }
          : s,
      );

      pushToast(existing?.id ? "Natija yangilandi" : "Natija saqlandi");
      return true;
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlab bo'lmadi", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selected || !template) return;
    if (!canEditResults) return;

    setDownloading(true);
    try {
      const saved = await handleSaveValues();
      if (!saved) return;

      flushSync(() => setExporting(true));
      await new Promise(r => setTimeout(r, 80));

      const el = pdfRef.current;
      if (!el) {
        pushToast("PDF element topilmadi", "error");
        return;
      }

      const safeName = selected.analysisName
        .replace(/[^\w\u0400-\u04FF\u0500-\u052F\-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 60);
      await downloadElementAsPdf(el, `natija_${selected.orderId}_${safeName || "analiz"}.pdf`);
      pushToast("PDF yuklab olindi");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "PDF yuklab bo'lmadi", "error");
    } finally {
      setExporting(false);
      setDownloading(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!selected || !template || printing) return;

    setPrinting(true);
    try {
      // Chop etish paytida tahrirlashni vaqtincha o'chirish
      if (canEditResults) {
        flushSync(() => setExporting(true));
        await new Promise(r => setTimeout(r, 80));
      }

      const el = pdfRef.current;
      if (!el) {
        pushToast("Chop etish uchun PDF tayyor emas", "error");
        return;
      }

      await printElementAsPdf(el);
      pushToast("Chop etish oynasi ochildi");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Chop etib bo'lmadi", "error");
    } finally {
      if (canEditResults) setExporting(false);
      setPrinting(false);
    }
  };

  if (selected) {
    const hasTable = Boolean(template?.elements.some(el => el.type === "table"));
    const tableEl = template?.elements.find(el => el.type === "table");
    const grid = hasTable ? normalizeTableData(tableEl?.tableData) : null;
    const pdfReadOnly = exporting || !canEditResults;
    const useOverlayEdit =
      canEditResults &&
      !exporting &&
      (isKassirSangig || selected.orderType === "sample");
    const previewPageHeight = template
      ? getPdfPreviewHeight(template)
      : A4_PREVIEW_HEIGHT;
    const previewPageWidth = template
      ? getPdfPreviewWidth(template)
      : A4_PREVIEW_WIDTH;

    return (
      <main className="flex-1 overflow-y-auto p-6 space-y-4 ses-scrollbar">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={closeDetail}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-foreground">
              {selected.analysisName}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Buyurtma #{selected.orderId} · {selected.patientName}
              {selected.laboratoryName !== "—" ? ` · ${selected.laboratoryName}` : ""}
              {selected.resultId ? ` · Result #${selected.resultId}` : ""}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-[11px] text-muted-foreground">
            {canEditResults ? (
              <>
                <Lock className="w-3 h-3" />
                {useOverlayEdit ? "Jadval kataklari va PDF ustiga yozuv" : "Faqat jadval inputlari"}
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" /> Faqat ko&apos;rish
              </>
            )}
          </div>
          {canEditResults && (
            <>
              <button
                type="button"
                disabled={saving || downloading || printing || !template}
                onClick={() => void handleSaveValues()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
                style={{ background: primaryColor }}
              >
                {saving && !downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {selected.resultId ? "Yangilash" : "Saqlash"}
              </button>
              <button
                type="button"
                disabled={saving || downloading || printing || !template || opening}
                onClick={() => void handleDownloadPdf()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground border border-border hover:opacity-90 disabled:opacity-50"
              >
                {downloading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                Yuklab olish
              </button>
            </>
          )}
          <button
            type="button"
            disabled={printing || !template || opening || saving || downloading}
            onClick={() => void handlePrintPdf()}
            className={
              canEditResults
                ? "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground border border-border hover:opacity-90 disabled:opacity-50"
                : "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
            }
            style={canEditResults ? undefined : { background: primaryColor }}
          >
            {printing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Printer className="w-3.5 h-3.5" />
            )}
            Chop etish
          </button>
        </div>

        {opening ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : availableTemplates.length > 1 ? (
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">PDF shablonlar</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {selected.laboratoryName !== "—" ? `${selected.laboratoryName} · ` : ""}
                {selected.analysisName} — kerakli shablonni tanlang, keyin ichiga ma&apos;lumot kiriting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableTemplates.map(item => {
                const active = template?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTemplateChange(item.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                      active
                        ? "text-white border-transparent"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                    style={active ? { background: primaryColor } : undefined}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {item.name || "Shablon"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {opening ? null : !template && availableTemplates.length > 0 ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">Shablonni tanlang</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Yuqoridagi ro&apos;yxatdan shu analizning PDF shablonini bosing, keyin kataklarga ma&apos;lumot kiriting
            </p>
          </div>
        ) : !template ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">PDF shablon topilmadi</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Bu laboratoriya analizi uchun Boshqaruv → PDF shablon bo&apos;limida shablon yarating va saqlang
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">{template.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  {grid
                    ? `Header ${grid.headerRows} · Body ${grid.bodyRows} · ${grid.cols} ustun${useOverlayEdit ? " · yozuvni sudrab joylang" : ""}`
                    : useOverlayEdit
                      ? "Saqlangan yozuvni sudrab joyini o'zgartirish mumkin"
                      : "PDF shablon"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-0.5 rounded-xl bg-secondary border border-border p-0.5">
                  <button
                    type="button"
                    title="Uzoqlashtirish"
                    disabled={pdfZoom <= PDF_ZOOM_MIN}
                    onClick={zoomOut}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Masshtabni tiklash"
                    onClick={zoomReset}
                    className="min-w-[3.25rem] px-1.5 h-8 rounded-lg text-[11px] font-semibold text-foreground hover:bg-card tabular-nums"
                  >
                    {Math.round(pdfZoom * 100)}%
                  </button>
                  <button
                    type="button"
                    title="Yaqinlashtirish"
                    disabled={pdfZoom >= PDF_ZOOM_MAX}
                    onClick={zoomIn}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-foreground hover:bg-card disabled:opacity-40"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span
                  className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(selected.itemStatus)}`}
                >
                  {statusLabel(selected.itemStatus)}
                </span>
              </div>
            </div>
            <div className="p-4 md:p-6 overflow-auto ses-scrollbar bg-secondary/40 max-h-[calc(100vh-180px)]">
              <div
                className="mx-auto"
                style={{
                  width: previewPageWidth * pdfZoom,
                  height: previewPageHeight * pdfZoom,
                }}
              >
                <div
                  style={{
                    width: previewPageWidth,
                    transform: `scale(${pdfZoom})`,
                    transformOrigin: "top left",
                  }}
                >
                  <ResultPdfCanvas
                    ref={pdfRef}
                    template={template}
                    fillValues={fillValues}
                    dynamicCtx={dynamicCtx}
                    onFillChange={canEditResults ? updateFill : undefined}
                    readOnly={pdfReadOnly}
                    overlayEdit={useOverlayEdit}
                    withMargins={pdfReadOnly}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <ToastStack toasts={toasts} setToasts={setToasts} />
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                applySearch();
              }
            }}
            placeholder={
              isKassirSangig || (isKassir && orderTypeTab === "sample")
                ? "Qidirish: tashkilot, analiz, buyurtma..."
                : "Qidirish: bemor, analiz, buyurtma..."
            }
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const next = searchInput.trim();
            if (next !== search) {
              setPage(1);
              setSearch(next);
            } else {
              void load({ page, search: next });
            }
          }}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary text-[12px] font-semibold text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Yangilash
        </button>
        <div className="text-[12px] text-muted-foreground ml-auto">
          Jami: <span className="font-semibold text-foreground">{total}</span> ta · Sahifa {page}/{totalPages}
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <FileBarChart2 className="w-4 h-4" style={{ color: primaryColor }} />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">Natijalar</h2>
            <p className="text-[11px] text-muted-foreground">
              {isKassirSangig
                ? "Tashkilot (sample) buyurtmalari — PDF natija"
                : isKassir
                ? orderTypeTab === "sample"
                  ? "Tashkilot buyurtmalari — PDF natijani ko'rish va chop etish"
                  : "Bemor buyurtmalari — PDF natijani ko'rish va chop etish"
                : "Buyurtmadagi analizlar — PDF shablon orqali natija kiritish"}
            </p>
          </div>
          {showOrderTypeTabs && (
            <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-secondary/70 border border-border">
              {RESULTS_ORDER_TABS.map(tab => {
                const active = orderTypeTab === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      if (tab.id === orderTypeTab) return;
                      setPage(1);
                      setOrderTypeTab(tab.id);
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors ${
                      active ? "text-white" : "text-muted-foreground hover:text-foreground"
                    }`}
                    style={active ? { background: primaryColor } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            {isKassirSangig
              ? "Tashkilot buyurtmalarida analiz topilmadi"
              : isKassir
              ? orderTypeTab === "sample"
                ? "Tashkilot buyurtmalarida analiz topilmadi"
                : "Bemor buyurtmalarida analiz topilmadi"
              : "Buyurtmalarda analiz topilmadi"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Buyurtma</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {isKassirSangig || (isKassir && orderTypeTab === "sample") ? "Tashkilot" : "Bemor"}
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Analiz</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Laboratoriya</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Holat</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Natija</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sana</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr
                    key={r.key}
                    onClick={() => void openRow(r)}
                    className="border-b border-border last:border-0 hover:bg-secondary/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[13px] font-medium text-foreground">#{r.orderId}</td>
                    <td className="px-4 py-3 text-[13px] text-foreground">{r.patientName}</td>
                    <td className="px-4 py-3 text-[13px] text-foreground font-medium">{r.analysisName}</td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground">{r.laboratoryName}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(r.itemStatus)}`}>
                        {statusLabel(r.itemStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.hasSavedValues ? (
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/10 text-emerald-700">
                          Saqlangan
                        </span>
                      ) : (
                        <span className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-secondary text-muted-foreground">
                          Kiritilmagan
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-line">
                      {r.orderCreatedAt ? formatDate(r.orderCreatedAt) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          title="QR kod"
                          onClick={e => void openReceiptQr(e, r)}
                          disabled={qrLoadingKey != null}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                          {qrLoadingKey === r.key ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <QrCode className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-[11px] font-semibold" style={{ color: primaryColor }}>
                          PDF ochish
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border flex-wrap">
          <p className="text-[12px] text-muted-foreground">
            Jami: <span className="font-semibold text-foreground">{total}</span> ta · Sahifa {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => goPage(1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => goPage(page - 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => goPage(page + 1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => goPage(totalPages)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <ToastStack toasts={toasts} setToasts={setToasts} />

      {receiptView && (
        <ReceiptModal
          primaryColor={primaryColor}
          patient={receiptView.patient}
          items={receiptView.items}
          paymentMethod={receiptView.paymentMethod}
          paidAmount={receiptView.paidAmount}
          discountPercent={receiptView.discountPercent}
          totalBeforeDiscount={receiptView.totalBeforeDiscount}
          resultLinks={receiptView.resultLinks}
          initialAnalysisId={receiptView.initialAnalysisId}
          onClose={() => setReceiptView(null)}
        />
      )}
    </main>
  );
}

function ToastStack({
  toasts,
  setToasts,
}: {
  toasts: ToastMsg[];
  setToasts: React.Dispatch<React.SetStateAction<ToastMsg[]>>;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[60] space-y-2">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
        >
          {t.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {t.text}
          <button
            type="button"
            onClick={() => setToasts(list => list.filter(x => x.id !== t.id))}
            className="ml-1 opacity-80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
