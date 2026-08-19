import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  Search, RefreshCw, FileBarChart2, X, Loader2, CheckCircle, AlertCircle,
  ArrowLeft, Save, FileText, Lock, Download, ZoomIn, ZoomOut, Printer, Eye, QrCode,
} from "lucide-react";
import {
  getAllOrders,
  getOrderById,
  resolveOrderItemAnalysisId,
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
  resolveResultItemAnalysisId,
  updateResult,
  type ResultRecord,
} from "@/api/result";
import { getStoredUser } from "@/api/auth";
import { getStoredCompanyId } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { normalizeRoleName } from "@/lib/roles";
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
  bodyCellKey,
  fetchPdfTemplatesFromApi,
  getPdfPreviewHeight,
  headerCellKey,
  hydratePdfTemplateImages,
  hydratePdfTemplatesImages,
  isDynamicCell,
  loadPdfTemplates,
  normalizeTableData,
  resolveStoredCompanyDynamic,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

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

function resolveTemplateForAnalysis(
  analysisId: number,
  analysisName: string,
  list: PdfTemplate[],
): PdfTemplate | null {
  // Faqat berilgan ro'yxat (API). localStorage cache katta rasmlarni olib tashlaydi.
  const base =
    list.find(t => t.analysisId === analysisId) ||
    list.find(t => t.elements.some(el => el.type === "table" && el.analysisId === analysisId)) ||
    list.find(t => t.elements.some(el => el.type === "table")) ||
    list[0] ||
    null;

  if (!base) return null;
  return bindTemplateToAnalysis(base, analysisId, analysisName);
}

/** Seed fill map from dynamic cells only; saved values win when present */
function seedFillFromTemplate(
  tpl: PdfTemplate | null,
  saved: Record<string, string> = {},
): Record<string, string> {
  const table = tpl?.elements.find(el => el.type === "table");
  const grid = normalizeTableData(table?.tableData);
  const next: Record<string, string> = {};

  for (let r = 0; r < grid.headerRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.headerCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = headerCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }

  for (let r = 0; r < grid.bodyRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.bodyCells[r][c];
      if (cell.covered || !isDynamicCell(cell)) continue;
      const key = bodyCellKey(r, c);
      next[key] = Object.prototype.hasOwnProperty.call(saved, key)
        ? String(saved[key] ?? "")
        : "";
    }
  }
  return next;
}

export function ResultsPage({ primaryColor }: { primaryColor: string }) {
  const role = normalizeRoleName(getStoredUser()?.role?.name);
  const isKassir = role === "kassir";
  const canEditResults = !isKassir;

  const [rows, setRows] = useState<OrderAnalysisRow[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [resultsCache, setResultsCache] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
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

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [ordersRaw, results] = await Promise.all([
        getAllOrders(),
        getAllResults().catch(() => [] as ResultRecord[]),
      ]);
      const orders = Array.isArray(ordersRaw)
        ? ordersRaw
        : ((ordersRaw as { data?: Order[]; orders?: Order[] })?.data ??
          (ordersRaw as { orders?: Order[] })?.orders ??
          []);
      setResultsCache(results);
      setOrders(orders);
      setRows(flattenOrderAnalyses(orders, results));
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [
        String(r.orderId),
        String(r.orderItemId),
        r.patientName,
        r.analysisName,
        r.laboratoryName,
        r.itemStatus,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const openRow = async (row: OrderAnalysisRow) => {
    setOpening(true);
    setSelected(row);
    setPdfZoom(PDF_ZOOM_DEFAULT);
    try {
      const allTemplates = await fetchPdfTemplatesFromApi(getStoredCompanyId() ?? undefined).catch(
        async () => hydratePdfTemplatesImages(loadPdfTemplates()),
      );
      setAvailableTemplates(allTemplates);
      let tpl = resolveTemplateForAnalysis(row.analysisId, row.analysisName, allTemplates);
      if (tpl) {
        const hydrated = await hydratePdfTemplateImages(tpl);
        tpl = bindTemplateToAnalysis(hydrated, row.analysisId, row.analysisName);
      }
      setTemplate(tpl);

      let order: Order | null = null;
      try {
        order = await getOrderById(row.orderId);
      } catch {
        /* optional */
      }

      const company = await resolveStoredCompanyDynamic();

      let resultRec: ResultRecord | null = null;
      let savedItems: ReturnType<typeof getResultItems> = [];
      const cachedRec = findResultByOrderId(resultsCache, row.orderId);

      if (row.resultId) {
        try {
          resultRec = await getResultById(row.resultId);
          savedItems = getResultItems(resultRec);
        } catch {
          resultRec = cachedRec;
          savedItems = resultRec ? getResultItems(resultRec) : [];
        }
      } else {
        resultRec = cachedRec;
        savedItems = resultRec ? getResultItems(resultRec) : [];
      }

      // getby sometimes omits nested items — fall back to cache for fills
      if (savedItems.length === 0 && cachedRec) {
        const cachedItems = getResultItems(cachedRec);
        if (cachedItems.length > 0) {
          savedItems = cachedItems;
          if (!resultRec) resultRec = cachedRec;
        }
      }

      setDynamicCtx(buildDynamicContext(row, order, resultRec, company));
      const saved = decodeGridFillFromItems(savedItems, row.analysisId);
      setFillValues(seedFillFromTemplate(tpl, saved));

      if (!tpl?.elements.some(el => el.type === "table")) {
        pushToast(
          "PDF jadval shabloni topilmadi. Boshqaruv → PDF shablonida yarating.",
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
      try {
        order = await getOrderById(row.orderId);
      } catch {
        /* list dagi order yetarli bo'lishi mumkin */
      }
      if (!order) {
        pushToast("Buyurtma topilmadi", "error");
        return;
      }

      const templates = await fetchPdfTemplatesFromApi(getStoredCompanyId() ?? undefined).catch(() => [] as PdfTemplate[]);
      const orderItems = (order.items ?? []) as OrderItem[];
      const cartItems: ReceiptCartItem[] = orderItems
        .map(item => {
          const analysisId = resolveOrderItemAnalysisId(item);
          if (!analysisId) return null;
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
    const next = bindTemplateToAnalysis(base, selected.analysisId, selected.analysisName);
    setTemplate(next);
    setFillValues(prev => seedFillFromTemplate(next, prev));
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
    if (!selected || !template || !hasTableReady()) return;
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
    if (!selected || !template || !hasTableReady() || printing) return;

    setPrinting(true);
    try {
      // Kassir already views with margins; others briefly switch to export layout
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

  const hasTableReady = () => Boolean(template?.elements.some(el => el.type === "table"));

  if (selected) {
    const hasTable = Boolean(template?.elements.some(el => el.type === "table"));
    const tableEl = template?.elements.find(el => el.type === "table");
    const grid = normalizeTableData(tableEl?.tableData);
    const pdfReadOnly = exporting || !canEditResults;
    const previewPageHeight = template
      ? getPdfPreviewHeight(template, pdfReadOnly)
      : A4_PREVIEW_HEIGHT;

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
          {canEditResults && (
            <label className="flex items-center gap-2 min-w-[200px] max-w-xs">
              <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
                Shablon
              </span>
              <select
                value={template?.id ?? ""}
                disabled={opening || availableTemplates.length === 0}
                onChange={e => handleTemplateChange(e.target.value)}
                className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[12px] font-medium text-foreground focus:outline-none focus:border-[var(--primary)] disabled:opacity-50"
              >
                {availableTemplates.length === 0 ? (
                  <option value="">Shablon yo&apos;q</option>
                ) : (
                  availableTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          )}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-[11px] text-muted-foreground">
            {canEditResults ? (
              <>
                <Lock className="w-3 h-3" /> Faqat jadval inputlari
              </>
            ) : (
              <>
                <Eye className="w-3 h-3" /> Faqat ko&apos;rish
              </>
            )}
          </div>
          {canEditResults ? (
            <>
              <button
                type="button"
                disabled={saving || downloading || printing || !hasTable}
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
                disabled={saving || downloading || printing || !hasTable || opening}
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
          ) : (
            <button
              type="button"
              disabled={printing || !hasTable || opening}
              onClick={() => void handlePrintPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: primaryColor }}
            >
              {printing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
              Chop etish
            </button>
          )}
        </div>

        {opening ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : !template ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">PDF shablon topilmadi</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              Avval Boshqaruv → PDF shablon bo&apos;limida shablon yarating va saqlang
            </p>
          </div>
        ) : !hasTable ? (
          <div className="bg-card rounded-2xl border border-border p-8 text-center">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-[13px] font-medium text-foreground">Shablonda jadval yo&apos;q</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              PDF shablonga Jadval instrumentini qo&apos;shing va o&apos;zingiz chizing
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
              <div>
                <h3 className="text-[13px] font-semibold text-foreground">{template.name}</h3>
                <p className="text-[11px] text-muted-foreground">
                  Header {grid.headerRows} · Body {grid.bodyRows} · {grid.cols} ustun
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
                  width: A4_PREVIEW_WIDTH * pdfZoom,
                  height: previewPageHeight * pdfZoom,
                }}
              >
                <div
                  style={{
                    width: A4_PREVIEW_WIDTH,
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
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Qidirish: bemor, analiz, buyurtma..."
            className="w-full bg-secondary border border-border rounded-xl pl-9 pr-3 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-secondary text-[12px] font-semibold text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Yangilash
        </button>
        <div className="text-[12px] text-muted-foreground ml-auto">
          Jami analizlar: <span className="font-semibold text-foreground">{filtered.length}</span>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileBarChart2 className="w-4 h-4" style={{ color: primaryColor }} />
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Natijalar</h2>
            <p className="text-[11px] text-muted-foreground">
              {isKassir
                ? "Buyurtmadagi analizlar — PDF natijani ko'rish va chop etish"
                : "Buyurtmadagi analizlar — PDF shablon orqali natija kiritish"}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-[13px] text-muted-foreground">
            Buyurtmalarda analiz topilmadi
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Buyurtma</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bemor</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Analiz</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Laboratoriya</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Holat</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Natija</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Sana</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
            t.type === "success" ? "bg-emerald-600" : "bg-red-600"
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
