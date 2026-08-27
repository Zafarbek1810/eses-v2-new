import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, FileText, Loader2, Lock } from "lucide-react";
import {
  getOnlineStorageByIdTwo,
  resolveOnlineStorageAnalysisId,
} from "@/api/onlineStorage";
import {
  getOrderByIdTwo,
  resolveOrderItemAnalysisId,
  type Order,
  type OrderItem,
  type OrderPatient,
} from "@/api/order";
import {
  decodeGridFillFromItems,
  getResultByIdTwo,
  getResultItems,
  type ResultRecord,
} from "@/api/result";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import { downloadElementAsPdf } from "@/lib/pdfExport";
import {
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_WIDTH,
  bodyCellKey,
  getPdfPreviewHeight,
  getPdfPreviewWidth,
  headerCellKey,
  isDynamicCell,
  normalizeTableData,
  onlineStorageRecordToPdfTemplate,
  resolveStoredCompanyDynamic,
  type PdfDynamicContext,
  type PdfTemplate,
} from "@/lib/pdfTemplate";
import {
  buildShowResultPin,
  type ShowResultParams,
} from "@/lib/showResultLink";

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      template: PdfTemplate;
      fillValues: Record<string, string>;
      dynamicCtx: PdfDynamicContext;
      analysisName: string;
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
      if (cell.covered) continue;
      const key = headerCellKey(r, c);
      const hasSaved = Object.prototype.hasOwnProperty.call(saved, key);
      // Public view: valueMode yo'qolgan bo'lsa ham saqlangan qiymatni ko'rsatamiz
      if (!isDynamicCell(cell) && !hasSaved) continue;
      next[key] = hasSaved ? String(saved[key] ?? "") : "";
    }
  }

  for (let r = 0; r < grid.bodyRows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const cell = grid.bodyCells[r][c];
      if (cell.covered) continue;
      const key = bodyCellKey(r, c);
      const hasSaved = Object.prototype.hasOwnProperty.call(saved, key);
      if (!isDynamicCell(cell) && !hasSaved) continue;
      next[key] = hasSaved ? String(saved[key] ?? "") : "";
    }
  }

  // Shablon kataklari bilan mos kelmasa ham, saqlangan fill larni saqlab qolamiz
  for (const [k, v] of Object.entries(saved)) {
    if (!Object.prototype.hasOwnProperty.call(next, k)) {
      next[k] = String(v ?? "");
    }
  }
  return next;
}

function labDoctorFromResult(result: ResultRecord | null): string | null {
  const d = result?.lab_director;
  if (!d) return null;
  const initial = (d.username || "").charAt(0).toUpperCase();
  const surname = d.surname || "";
  const name = `${initial}.${surname}`.replace(/^\./, "").replace(/\.$/, "");
  return name || null;
}

function labAssistantFromResult(result: ResultRecord | null): string | null {
  const raw = result as Record<string, unknown> | null;
  const a =
    (raw?.lab_assistant as { username?: string; surname?: string } | null | undefined) ??
    (raw?.labAssistant as { username?: string; surname?: string } | null | undefined) ??
    null;
  if (!a || typeof a !== "object") return null;
  const initial = (a.username || "").charAt(0).toUpperCase();
  const surname = a.surname || "";
  const name = `${initial}.${surname}`.replace(/^\./, "").replace(/\.$/, "");
  return name || null;
}

export function ShowResultPage({ params }: { params: ShowResultParams }) {
  const expectedPin = buildShowResultPin(params);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const pdfRef = useRef<HTMLDivElement>(null);

  const handleVerifyPin = (e?: React.FormEvent) => {
    e?.preventDefault();
    const entered = pin.replace(/\D/g, "");
    if (!entered) {
      setPinError("PIN-kodni kiriting");
      return;
    }
    if (entered !== expectedPin) {
      setPinError("PIN-kod noto'g'ri");
      return;
    }
    setPinError(null);
    setUnlocked(true);
  };

  useEffect(() => {
    if (!unlocked) return;

    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });
      try {
        const [order, storage, result] = await Promise.all([
          getOrderByIdTwo(params.orderId),
          getOnlineStorageByIdTwo(params.storageId),
          getResultByIdTwo(params.orderId).catch(() => null),
        ]);

        const tpl = onlineStorageRecordToPdfTemplate(storage);
        if (!tpl) {
          throw new Error("PDF shablon formati noto'g'ri");
        }

        const storageAnalysisId = resolveOnlineStorageAnalysisId(storage);
        const analysisId = params.analysisId;

        if (
          storageAnalysisId != null &&
          storageAnalysisId > 0 &&
          storageAnalysisId !== analysisId
        ) {
          throw new Error(
            `Shablon boshqa analizga bog'langan (analiz #${storageAnalysisId})`,
          );
        }

        const items = (order.items ?? []) as OrderItem[];
        const orderItem =
          items.find(it => resolveOrderItemAnalysisId(it) === analysisId) ?? null;

        const analysisName =
          orderItem?.analysis?.name ||
          storage.analysis?.name ||
          tpl.analysisName ||
          `Analiz #${analysisId}`;

        const laboratoryName = orderItem?.laboratory?.name ?? null;

        const bound: PdfTemplate = {
          ...structuredClone(tpl),
          analysisId,
          analysisName,
        };
        const table = bound.elements.find(el => el.type === "table");
        if (table) {
          table.analysisId = analysisId;
          table.analysisName = analysisName;
        }

        let savedItems = getResultItems(result);
        // Order javobida natija biriktirilgan bo'lishi mumkin
        if (savedItems.length === 0 && order && typeof order === "object") {
          const orderBag = order as unknown as Record<string, unknown>;
          const embedded =
            orderBag.result ??
            orderBag.results ??
            orderBag.result_item ??
            orderBag.result_items;
          if (embedded) {
            if (Array.isArray(embedded)) {
              for (const entry of embedded) {
                if (!entry || typeof entry !== "object") continue;
                const fromEntry = getResultItems(entry as ResultRecord);
                if (fromEntry.length > 0) {
                  savedItems = fromEntry;
                  break;
                }
                // To'g'ridan-to'g'ri result_item elementlari
                if (
                  "name" in (entry as object) ||
                  "normValue" in (entry as object) ||
                  "norm_value" in (entry as object)
                ) {
                  savedItems = embedded as ReturnType<typeof getResultItems>;
                  break;
                }
              }
            } else if (typeof embedded === "object") {
              savedItems = getResultItems(embedded as ResultRecord);
            }
          }
        }

        const saved = decodeGridFillFromItems(savedItems, analysisId);
        const fillValues = seedFillFromTemplate(bound, saved);
        const company = await resolveStoredCompanyDynamic(bound.companyId);

        const dynamicCtx: PdfDynamicContext = {
          orderId: order.id,
          orderCreatedAt: orderItem?.createdAt || order.createdAt || null,
          resultId: result?.id ?? null,
          resultDate: result?.updatedAt || result?.createdAt || new Date().toISOString(),
          patientFullName: patientName(order.patient, order.name),
          patientAddress: buildAddress(order, order.patient),
          patientBirthDay: order.patient?.birth_day ?? null,
          patientRegisteredAt: order.patient?.createdAt ?? null,
          patientPhone: order.patient?.phone ?? null,
          labDoctor: labDoctorFromResult(result),
          labAssistant: labAssistantFromResult(result),
          companyName: company.companyName,
          analysisName,
          laboratoryName,
          companyRegion: company.companyRegion,
          companyDistrict: company.companyDistrict,
          companyAddress: company.companyAddress,
          companyPhone: company.companyPhone,
          companyFax: company.companyFax,
          companyWebsite: company.companyWebsite,
          companyTelegram: company.companyTelegram,
        };

        if (!cancelled) {
          setState({
            status: "ready",
            template: bound,
            fillValues,
            dynamicCtx,
            analysisName,
          });
        }
      } catch {
        if (cancelled) return;
        setState({ status: "error" });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [unlocked, params.orderId, params.analysisId, params.storageId]);

  const handleDownloadPdf = async () => {
    if (state.status !== "ready" || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const el = pdfRef.current;
      if (!el) {
        throw new Error("PDF element topilmadi");
      }

      const safeName = state.analysisName
        .replace(/[^\w\u0400-\u04FF\u0500-\u052F\-]+/g, "_")
        .replace(/_+/g, "_")
        .slice(0, 60);
      await downloadElementAsPdf(el, `natija_${params.orderId}_${safeName || "analiz"}.pdf`);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "PDF yuklab bo'lmadi",
      );
    } finally {
      setDownloading(false);
    }
  };

  const previewPageHeight =
    state.status === "ready"
      ? getPdfPreviewHeight(state.template, true)
      : A4_PREVIEW_HEIGHT;
  const previewPageWidth =
    state.status === "ready"
      ? getPdfPreviewWidth(state.template, true)
      : A4_PREVIEW_WIDTH;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight">SES — tahlil natijasi</p>
              <p className="truncate text-xs text-slate-500">
                {unlocked
                  ? `Buyurtma #${params.orderId}${state.status === "ready" ? ` · ${state.analysisName}` : ""}`
                  : "Natijani ochish uchun PIN-kod kerak"}
              </p>
            </div>
          </div>

          {state.status === "ready" && (
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-60"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {downloading ? "Yuklanmoqda..." : "Yuklab olish"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {!unlocked && (
          <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-center text-base font-semibold text-slate-900">
              PIN-kodni kiriting
            </h1>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Natijani ko&apos;rish uchun PIN-kodni kiriting
            </p>
            <form className="mt-5" onSubmit={handleVerifyPin}>
              <label className="sr-only" htmlFor="showresult-pin">
                PIN-kod
              </label>
              <input
                id="showresult-pin"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={expectedPin.length}
                value={pin}
                onChange={e => {
                  const next = e.target.value.replace(/\D/g, "").slice(0, expectedPin.length);
                  setPin(next);
                  if (next.length === expectedPin.length) {
                    if (next === expectedPin) {
                      setPinError(null);
                      setUnlocked(true);
                    } else {
                      setPinError("PIN-kod noto'g'ri");
                    }
                  } else {
                    setPinError(null);
                  }
                }}
                placeholder="PIN-kod"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-400 focus:border-teal-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/15"
              />
              {pinError && (
                <p className="mt-2 text-center text-sm text-red-600">{pinError}</p>
              )}
              <button
                type="submit"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
              >
                Tasdiqlash
              </button>
            </form>
          </div>
        )}

        {unlocked && downloadError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {downloadError}
          </div>
        )}

        {unlocked && state.status === "loading" && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            <p className="text-sm">PDF natija yuklanmoqda...</p>
          </div>
        )}

        {unlocked && state.status === "error" && (
          <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm">
            <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
            <p className="text-sm font-medium text-slate-900">Natijani ochib bo&apos;lmadi</p>
          </div>
        )}

        {unlocked && state.status === "ready" && (
          <div className="flex flex-col items-center gap-4 pb-8">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-[14px] font-bold text-white shadow-md hover:bg-teal-700 disabled:opacity-60 sm:hidden"
            >
              {downloading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              PDF yuklab olish
            </button>

            <div className="overflow-auto">
              <div
                className="shadow-lg ring-1 ring-slate-200"
                style={{ width: previewPageWidth, minHeight: previewPageHeight }}
              >
                <ResultPdfCanvas
                  ref={pdfRef}
                  template={state.template}
                  fillValues={state.fillValues}
                  dynamicCtx={state.dynamicCtx}
                  readOnly
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
