import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, CheckCircle, AlertCircle, FileText, Loader2, ShieldCheck, Link2, Printer,
} from "lucide-react";
import { buildShowResultUrl } from "@/lib/showResultLink";
import { copyTextToClipboard } from "@/lib/copyText";
import {
  getOrderById,
  resolveOrderItemAnalysisId,
  updateOrder,
  updateOrderItemStatus,
  updateOrderStatus,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import {
  decodeGridFillFromItems,
  findResultByOrderId,
  getAllResults,
  getResultById,
  getResultItems,
  type ResultRecord,
} from "@/api/result";
import { getStoredCompanyId, getStoredUser } from "@/api/session";
import { getAllLaboratories } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import { printElementAsPdf } from "@/lib/pdfExport";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { normalizeRoleName } from "@/lib/roles";
import {
  filterOrderItemsByLabScope,
  orderItemInLabScope,
  resolveUserLabScope,
  type LabScope,
} from "@/lib/labScope";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  bodyCellKey,
  fetchPdfTemplatesFromApi,
  getPdfPreviewHeight,
  getPdfPreviewWidth,
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

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

type AnalysisPdfView = {
  key: string;
  analysisId: number;
  analysisName: string;
  laboratoryName: string;
  itemStatus: string;
  template: PdfTemplate | null;
  fillValues: Record<string, string>;
  dynamicCtx: PdfDynamicContext;
  hasSavedValues: boolean;
};

function patientName(patient: OrderPatient | null | undefined, fallback?: string | null) {
  if (!patient) return fallback?.trim() || "—";
  return `${patient.last_name ?? ""} ${patient.first_name ?? ""}`.trim() || "—";
}

function buildAddress(order: Order, patient: OrderPatient | null | undefined) {
  const parts = [
    patient?.village || order.village,
    patient?.street || order.street,
    order.district?.name,
  ].filter(Boolean);
  return parts.join(", ") || "—";
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
  const base =
    list.find(t => t.analysisId === analysisId) ||
    list.find(t => t.elements.some(el => el.type === "table" && el.analysisId === analysisId)) ||
    list.find(t => t.elements.some(el => el.type === "table")) ||
    list[0] ||
    null;
  if (!base) return null;
  return bindTemplateToAnalysis(base, analysisId, analysisName);
}

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

function statusBadgeClass(status: string) {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "pending":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "in_progress":
    case "partially_completed":
      return "bg-teal-500/10 text-teal-700 dark:text-teal-400";
    case "canceled":
    case "refunded":
      return "bg-red-500/10 text-red-600 dark:text-red-400";
    default:
      return "bg-secondary text-muted-foreground";
  }
}

export function OrderResultsReview({
  orderId,
  primaryColor,
  onBack,
  onConfirmed,
}: {
  orderId: number;
  primaryColor: string;
  onBack: () => void;
  onConfirmed?: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [order, setOrder] = useState<Order | null>(null);
  const [views, setViews] = useState<AnalysisPdfView[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const pdfRef = useRef<HTMLDivElement>(null);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderData, results, templates] = await Promise.all([
        getOrderById(orderId),
        getAllResults().catch(() => [] as ResultRecord[]),
        fetchPdfTemplatesFromApi(getStoredCompanyId() ?? undefined).catch(() =>
          hydratePdfTemplatesImages(loadPdfTemplates()),
        ),
      ]);

      setOrder(orderData);

      let resultRec = findResultByOrderId(results, orderId);
      if (resultRec?.id) {
        try {
          const full = await getResultById(resultRec.id);
          if (full) resultRec = full;
        } catch {
          /* keep list result */
        }
      }

      const savedItems = getResultItems(resultRec);
      const userDoc = getStoredUser();
      const shortName = userDoc
        ? `${(userDoc.username || "").charAt(0).toUpperCase()}.${userDoc.surname || ""}`
            .replace(/^\./, "")
            .replace(/\.$/, "") || null
        : null;
      const role = normalizeRoleName(userDoc?.role?.name);
      const isAssistant = role === "lab_asistant";
      const restrictToOwnLab = role === "lab_director" || role === "lab_asistant";
      const company = await resolveStoredCompanyDynamic();

      let labScope: LabScope | null = null;
      if (restrictToOwnLab && userDoc?.id) {
        try {
          const labs = await getAllLaboratories();
          labScope = resolveUserLabScope(Array.isArray(labs) ? labs : [], userDoc.id);
        } catch {
          labScope = { labIds: new Set(), analysisIds: new Set() };
        }
      }

      const orderItems = labScope
        ? filterOrderItemsByLabScope(orderData.items as OrderItem[] | undefined, labScope)
        : ((orderData.items ?? []) as OrderItem[]);

      const nextViews: AnalysisPdfView[] = [];
      for (const item of orderItems) {
        const analysisId = resolveOrderItemAnalysisId(item);
        if (!analysisId) continue;
        const analysisName = item.analysis?.name ?? `Analiz #${analysisId}`;
        const laboratoryName = item.laboratory?.name ?? "—";
        const resolved = resolveTemplateForAnalysis(analysisId, analysisName, templates);
        const tpl = resolved
          ? bindTemplateToAnalysis(
              await hydratePdfTemplateImages(resolved),
              analysisId,
              analysisName,
            )
          : null;
        const saved = decodeGridFillFromItems(savedItems, analysisId);
        const hasSavedValues = Object.values(saved).some(v => String(v ?? "").trim() !== "");

        nextViews.push({
          key: `${orderId}-${item.id}`,
          analysisId,
          analysisName,
          laboratoryName,
          itemStatus: String(item.status || "pending"),
          template: tpl,
          fillValues: seedFillFromTemplate(tpl, saved),
          hasSavedValues,
          dynamicCtx: {
            orderId,
            orderCreatedAt: item.createdAt || orderData.createdAt || null,
            resultId: resultRec?.id ?? null,
            resultDate: resultRec?.updatedAt || resultRec?.createdAt || new Date().toISOString(),
            patientFullName: patientName(orderData.patient, orderData.name),
            patientAddress: buildAddress(orderData, orderData.patient),
            patientBirthDay: orderData.patient?.birth_day ?? null,
            patientRegisteredAt: orderData.patient?.createdAt ?? null,
            patientPhone: orderData.patient?.phone ?? null,
            labDoctor: isAssistant ? null : shortName,
            labAssistant: isAssistant ? shortName : null,
            companyName: company.companyName,
            analysisName,
            laboratoryName: laboratoryName !== "—" ? laboratoryName : null,
            companyRegion: company.companyRegion,
            companyDistrict: company.companyDistrict,
            companyAddress: company.companyAddress,
            companyPhone: company.companyPhone,
            companyFax: company.companyFax,
            companyWebsite: company.companyWebsite,
            companyTelegram: company.companyTelegram,
          },
        });
      }

      setViews(nextViews);
      setActiveKey(nextViews[0]?.key ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Buyurtma natijalarini yuklab bo'lmadi");
      setOrder(null);
      setViews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const handleConfirm = async () => {
    if (!order || confirming) return;
    setConfirming(true);
    try {
      const role = normalizeRoleName(getStoredUser()?.role?.name);
      const restrictToOwnLab = role === "lab_director" || role === "lab_asistant";
      let labScope: LabScope | null = null;
      if (restrictToOwnLab) {
        const userId = getStoredUser()?.id;
        if (userId) {
          try {
            const labs = await getAllLaboratories();
            labScope = resolveUserLabScope(Array.isArray(labs) ? labs : [], userId);
          } catch {
            labScope = null;
          }
        }
      }

      const allItems = (order.items ?? []) as OrderItem[];
      const itemsToComplete = labScope
        ? allItems.filter(item => orderItemInLabScope(item, labScope!))
        : allItems;

      for (const item of itemsToComplete) {
        const st = String(item.status || "");
        if (st !== "completed" && st !== "canceled") {
          await updateOrderItemStatus(item.id, "completed");
        }
      }

      const resultLinks = views
        .filter(v => v.template?.storageId != null && v.template.storageId > 0)
        .map(v =>
          buildShowResultUrl({
            orderId: order.id,
            analysisId: v.analysisId,
            storageId: v.template!.storageId!,
          }),
        );
      const result_link_sms = resultLinks[0] ?? "";

      let smsOk = true;
      try {
        await updateOrder(order.id, {
          completed_sms: true,
          ...(result_link_sms ? { result_link_sms } : {}),
        });
      } catch {
        smsOk = false;
      }

      const completedIds = new Set(itemsToComplete.map(i => i.id));
      const allDone = allItems.every(item => {
        if (completedIds.has(item.id)) return true;
        const st = String(item.status || "");
        return st === "completed" || st === "canceled";
      });
      await updateOrderStatus(order.id, allDone ? "completed" : "partially_completed");

      const msg = allDone
        ? smsOk
          ? "Buyurtma yakunlandi. SMS yuborildi"
          : "Buyurtma yakunlandi, lekin SMS yuborib bo'lmadi"
        : "Laboratoriya analizlari tasdiqlandi";
      onConfirmed?.(msg, allDone && smsOk ? "success" : "info");
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : "Buyurtmani tasdiqlab bo'lmadi",
        "error",
      );
    } finally {
      setConfirming(false);
    }
  };

  const handlePrint = async () => {
    if (printing) return;
    const el = pdfRef.current;
    if (!el) {
      pushToast("Chop etish uchun PDF tayyor emas", "error");
      return;
    }
    setPrinting(true);
    try {
      await printElementAsPdf(el);
      pushToast("Chop etish oynasi ochildi", "info");
    } catch (err) {
      pushToast(err instanceof Error ? err.message : "Chop etib bo'lmadi", "error");
    } finally {
      setPrinting(false);
    }
  };

  const active = views.find(v => v.key === activeKey) ?? views[0] ?? null;
  const isCompleted = String(order?.status ?? "") === "completed";
  const hasTable = Boolean(active?.template?.elements.some(el => el.type === "table"));
  const canPrint = Boolean(active?.template && hasTable && !loading && !error);
  const previewPageHeight = active?.template
    ? getPdfPreviewHeight(active.template, true)
    : A4_PREVIEW_HEIGHT;
  const previewPageWidth = active?.template
    ? getPdfPreviewWidth(active.template, true)
    : A4_PREVIEW_WIDTH;

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="fixed top-20 right-6 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-card min-w-[260px]"
            style={{
              borderColor:
                t.type === "success" ? "#86efac" : t.type === "error" ? "#fca5a5" : "#93c5fd",
            }}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground hover:opacity-90"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold text-foreground">
            Buyurtma #{orderId} — PDF natijalar
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {order
              ? `${patientName(order.patient, order.name)} · Tel: ${order.patient?.phone || "—"}`
              : "Yuklanmoqda..."}
            {order?.createdAt ? ` · ${formatDate(order.createdAt).replace("\n", " ")}` : ""}
          </p>
        </div>
        {order && (
          <span
            className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(String(order.status))}`}
          >
            {statusLabel(String(order.status))}
          </span>
        )}
      </div>

      {order && (
        <section
          className="rounded-2xl border-2 p-4 sm:p-5 flex flex-wrap items-center gap-4"
          style={{
            borderColor: isCompleted ? "#86efac" : primaryColor,
            background: isCompleted ? "rgba(16,185,129,0.06)" : `${primaryColor}10`,
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: isCompleted ? "#10b98122" : `${primaryColor}22` }}
          >
            <ShieldCheck
              className="w-6 h-6"
              style={{ color: isCompleted ? "#10b981" : primaryColor }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-foreground">
              {isCompleted ? "Buyurtma tasdiqlangan" : "Laboratoriya mudiri tasdiqlashi"}
            </h3>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              {isCompleted
                ? "Holat: Yakunlangan. Bemorga completed SMS yuborilgan."
                : "Natijalarni ko‘rib chiqing va buyurtmani yakunlang — bemorga SMS yuboriladi."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canPrint || printing}
              onClick={() => void handlePrint()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-bold border border-border bg-card text-foreground shadow-sm hover:opacity-95 disabled:opacity-50 min-w-[160px]"
            >
              {printing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Printer className="w-5 h-5" />
              )}
              Chop etish
            </button>
            {!isCompleted && (
              <button
                type="button"
                disabled={confirming || loading}
                onClick={() => void handleConfirm()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[14px] font-bold text-white shadow-md hover:opacity-95 disabled:opacity-50 min-w-[220px]"
                style={{ background: primaryColor }}
              >
                {confirming ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-5 h-5" />
                )}
                Buyurtmani tasdiqlash
              </button>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <div className="py-16 flex flex-col items-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-muted-foreground">PDF natijalar yuklanmoqda...</p>
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm text-foreground">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            Qayta urinish
          </button>
        </div>
      ) : views.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-[13px] font-medium text-foreground">Analizlar topilmadi</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {views.map(v => (
              <button
                key={v.key}
                type="button"
                onClick={() => setActiveKey(v.key)}
                className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold border transition-colors ${
                  active?.key === v.key
                    ? "text-white border-transparent"
                    : "bg-secondary border-border text-foreground hover:opacity-90"
                }`}
                style={
                  active?.key === v.key
                    ? { background: primaryColor }
                    : undefined
                }
              >
                {v.analysisName}
                {v.hasSavedValues ? "" : " · kiritilmagan"}
              </button>
            ))}
          </div>

          {active && (
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-2 justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-foreground">
                    {active.analysisName}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {active.laboratoryName !== "—" ? active.laboratoryName : "Laboratoriya —"}
                    {" · "}
                    <span className={statusBadgeClass(active.itemStatus) + " px-1.5 py-0.5 rounded"}>
                      {statusLabel(active.itemStatus)}
                    </span>
                    {active.hasSavedValues ? " · Natija saqlangan" : " · Natija kiritilmagan"}
                  </p>
                </div>
                {active.template?.storageId != null && active.template.storageId > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const url = buildShowResultUrl({
                        orderId,
                        analysisId: active.analysisId,
                        storageId: active.template!.storageId!,
                      });
                      void copyTextToClipboard(url).then(ok => {
                        if (ok) pushToast("Natija linki nusxalandi");
                        else pushToast(url, "info");
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-border bg-secondary hover:opacity-90"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    SMS link
                  </button>
                )}
              </div>

              {!active.template ? (
                <div className="p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-foreground">PDF shablon topilmadi</p>
                </div>
              ) : !hasTable ? (
                <div className="p-8 text-center">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-[13px] font-medium text-foreground">Shablonda jadval yo&apos;q</p>
                </div>
              ) : (
                <div className="p-4 overflow-auto ses-scrollbar bg-slate-100/80 dark:bg-slate-900/40">
                  <div
                    className="mx-auto"
                    style={{ width: previewPageWidth, minHeight: previewPageHeight }}
                  >
                    <ResultPdfCanvas
                      ref={pdfRef}
                      template={active.template}
                      fillValues={active.fillValues}
                      dynamicCtx={active.dynamicCtx}
                      readOnly
                      withMargins
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
