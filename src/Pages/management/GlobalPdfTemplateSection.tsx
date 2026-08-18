import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  FileType,
  CheckCircle,
  AlertCircle,
  Loader2,
  Edit3,
  Trash2,
  ArrowLeft,
  TestTube2,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Copy,
  Plus,
} from "lucide-react";
import {
  deleteGlobalStorage,
  getGlobalStorageById,
  getGlobalStoragesFull,
  type GlobalStorage,
} from "@/api/globalStorage";
import { getAllBaseAnalyses, type BaseAnalysis } from "@/api/baseAnalysis";
import { getAllBaseLaboratories, type BaseLaboratory } from "@/api/baseLaboratory";
import { type Analysis } from "@/api/analysis";
import { type Laboratory } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import { formatDate } from "@/lib/formatDate";
import {
  cloneGlobalTemplateForLocalEdit,
  globalStorageRecordToPdfTemplate,
  type PdfTemplate,
} from "@/lib/pdfTemplate";
import { emptyTemplate, NewTemplateModal, PdfTemplateSection } from "./PdfTemplateSection";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const PER_PAGE = 10;

function baseLabId(item: BaseAnalysis): number | null {
  const id = Number(item.baselaboratory?.id ?? item.baselaboratory_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function toLaboratory(item: BaseLaboratory): Laboratory {
  return {
    id: item.id,
    name: item.name,
    createdAt: item.createdAt ?? "",
    analysis: item.analysis ?? [],
    lab_director: null,
    lab_assistants: [],
  };
}

function toAnalysis(item: BaseAnalysis): Analysis {
  const labId = baseLabId(item);
  return {
    id: item.id,
    name: item.name,
    shortname: item.shortname,
    price: item.price,
    createdAt: item.createdAt ?? "",
    laboratory: labId
      ? {
          id: labId,
          name: item.baselaboratory?.name ?? "",
          createdAt: item.baselaboratory?.createdAt ?? "",
          lab_director: null,
        }
      : null,
    onlinestorage: item.globalstorage,
  };
}

function globalTemplateAnalysisLabel(item: GlobalStorage, analyses: BaseAnalysis[]): string {
  const fromRelation = item.baseanalysis?.name?.trim() || item.analysis?.name?.trim();
  if (fromRelation) return fromRelation;
  const parsed = globalStorageRecordToPdfTemplate(item);
  if (parsed?.analysisName?.trim()) return parsed.analysisName.trim();
  const baseId = parsed?.baseAnalysisId ?? null;
  if (baseId != null) {
    const found = analyses.find(a => a.id === baseId);
    if (found?.name?.trim()) return found.name.trim();
  }
  return "";
}

export function GlobalPdfTemplateSection({
  primaryColor,
  onAdaptForLocal,
  companyId,
}: {
  primaryColor: string;
  /** Eski logika: clone qilib PDF shablon bo'limida online storage'ga saqlash */
  onAdaptForLocal?: (template: PdfTemplate) => void;
  companyId?: number;
}) {
  const [items, setItems] = useState<GlobalStorage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [labId, setLabId] = useState<string>("");
  const [analysisId, setAnalysisId] = useState<number | "">("");
  const [laboratories, setLaboratories] = useState<BaseLaboratory[]>([]);
  const [analyses, setAnalyses] = useState<BaseAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [viewing, setViewing] = useState<PdfTemplate | null>(null);
  const [editing, setEditing] = useState<PdfTemplate | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [loadingView, setLoadingView] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GlobalStorage | null>(null);

  const labAnalyses = useMemo(() => {
    if (!labId) return [];
    const id = Number(labId);
    return analyses.filter(a => baseLabId(a) === id);
  }, [analyses, labId]);

  const pickerLabs = useMemo(() => laboratories.map(toLaboratory), [laboratories]);
  const pickerAnalyses = useMemo(() => analyses.map(toAnalysis), [analyses]);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async (opts?: {
    page?: number;
    search?: string;
    analysis_id?: number | "";
  }) => {
    const nextPage = opts?.page ?? page;
    const nextSearch = opts?.search ?? search;
    const nextAnalysisId = opts?.analysis_id !== undefined ? opts.analysis_id : analysisId;
    setLoading(true);
    setError(null);
    try {
      const res = await getGlobalStoragesFull({
        page: nextPage,
        limit: PER_PAGE,
        search: nextSearch,
        ...(typeof nextAnalysisId === "number" && nextAnalysisId > 0
          ? { analysis_id: nextAnalysisId }
          : {}),
      });
      setItems(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof ApiError ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const [labs, allAnalyses] = await Promise.all([
          getAllBaseLaboratories(),
          getAllBaseAnalyses(),
        ]);
        setLaboratories(Array.isArray(labs) ? labs : []);
        setAnalyses(Array.isArray(allAnalyses) ? allAnalyses : []);
      } catch {
        /* filter selectlar bo'sh qolishi mumkin */
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [companyId]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    setSearch(q);
    setPage(1);
    void load({ page: 1, search: q, analysis_id: analysisId });
  };

  const handleLabChange = (value: string) => {
    setLabId(value);
    setAnalysisId("");
    setSearch("");
    setSearchInput("");
    setPage(1);
    void load({ page: 1, search: "", analysis_id: "" });
  };

  const handleAnalysisChange = (value: string) => {
    const next = value ? Number(value) : "";
    setAnalysisId(next);
    setPage(1);
    const analysisName =
      typeof next === "number"
        ? labAnalyses.find(a => a.id === next)?.name?.trim() ||
          analyses.find(a => a.id === next)?.name?.trim() ||
          ""
        : "";
    // Analiz tanlanganda getfull ga search sifatida analiz nomi yuboriladi
    const nextSearch = analysisName || searchInput.trim();
    setSearch(nextSearch);
    if (analysisName) setSearchInput(analysisName);
    void load({ page: 1, search: nextSearch, analysis_id: next });
  };

  const fetchTemplate = async (item: GlobalStorage): Promise<PdfTemplate | null> => {
    const full = await getGlobalStorageById(item.id);
    const tpl = globalStorageRecordToPdfTemplate(full);
    if (!tpl) {
      pushToast("Shablon ma'lumotini o'qib bo'lmadi", "error");
      return null;
    }
    return tpl;
  };

  const openView = async (item: GlobalStorage) => {
    setLoadingView(true);
    try {
      const tpl = await fetchTemplate(item);
      if (tpl) setViewing(tpl);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoadingView(false);
    }
  };

  /** Joyida global tahrirlash — globalStorageId saqlanadi */
  const openEdit = async (item?: GlobalStorage) => {
    setLoadingView(true);
    try {
      let tpl: PdfTemplate | null = null;
      if (item) {
        tpl = await fetchTemplate(item);
      } else if (viewing) {
        tpl = structuredClone(viewing);
      }
      if (!tpl) return;
      setViewing(null);
      setEditing(tpl);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoadingView(false);
    }
  };

  const handleConfirmNew = (analysis: Analysis) => {
    setNewModalOpen(false);
    setViewing(null);
    setEditing(emptyTemplate({ id: analysis.id, name: analysis.name }, { fromBaseCatalog: true }));
  };

  /** Eski logika: clone → PDF shablon → online storage */
  const openAdaptForLocal = async (item?: GlobalStorage) => {
    setLoadingView(true);
    try {
      let tpl: PdfTemplate | null = null;
      if (item) {
        tpl = await fetchTemplate(item);
      } else if (viewing) {
        tpl = structuredClone(viewing);
      }
      if (!tpl || !onAdaptForLocal) return;
      onAdaptForLocal(cloneGlobalTemplateForLocalEdit(tpl));
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yuklab bo'lmadi", "error");
    } finally {
      setLoadingView(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const item = deleteTarget;
    setDeletingId(item.id);
    try {
      await deleteGlobalStorage(item.id);
      if (viewing?.globalStorageId === item.id) setViewing(null);
      if (editing?.globalStorageId === item.id) setEditing(null);
      setDeleteTarget(null);
      pushToast("Global shablon o'chirildi");
      const nextTotal = Math.max(0, total - 1);
      const nextPage =
        page > 1 && (page - 1) * PER_PAGE >= nextTotal ? page - 1 : page;
      await load({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirib bo'lmadi", "error");
    } finally {
      setDeletingId(null);
    }
  };

  if (editing) {
    return (
      <PdfTemplateSection
        primaryColor={primaryColor}
        companyId={companyId}
        globalEditTemplate={editing}
        onGlobalEditConsumed={() => {
          /* editor ichiga o'tkazildi; parentda editing saqlanadi Orqaga uchun */
        }}
        onGlobalEditClose={() => {
          setEditing(null);
          void load();
        }}
        onGlobalEditSaved={() => {
          void load();
        }}
      />
    );
  }

  if (viewing) {
    return (
      <div className="space-y-4">
        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViewing(null)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileType className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{viewing.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {viewing.analysisName
                  ? viewing.analysisName
                  : viewing.analysisId
                    ? `Analiz #${viewing.analysisId}`
                    : "Analiz ko'rsatilmagan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void openEdit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white"
            style={{ background: primaryColor }}
          >
            <Edit3 className="w-3.5 h-3.5" /> Tahrirlash
          </button>
          {onAdaptForLocal && (
            <button
              type="button"
              onClick={() => void openAdaptForLocal()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-border bg-secondary text-foreground hover:opacity-90"
              title="O'z online storage'ga nusxa qilib PDF shablon bo'limida tahrirlash"
            >
              <Copy className="w-3.5 h-3.5" /> O&apos;ziga moslashtirish
            </button>
          )}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-4 overflow-auto">
          <p className="text-[12px] text-muted-foreground mb-3">
            <strong>Tahrirlash</strong> — shu global shablonni shu yerda yangilaydi.
            {onAdaptForLocal && (
              <>
                {" "}
                <strong>O&apos;ziga moslashtirish</strong> — PDF shablon bo&apos;limiga nusxa ochib,
                o&apos;z online storage&apos;ga saqlash uchun.
              </>
            )}
          </p>
          <div className="flex justify-center bg-secondary/40 rounded-xl p-4 overflow-auto">
            <ResultPdfCanvas
              template={viewing}
              fillValues={{}}
              dynamicCtx={null}
              readOnly
            />
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map(t => (
            <div
              key={t.id}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
                t.type === "success" ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {t.type === "success" ? (
                <CheckCircle className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              {t.text}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileType className="w-4 h-4 text-muted-foreground shrink-0" />
            <div>
              <h3 className="text-[14px] font-semibold text-foreground">Global PDF shablonlar</h3>
              <p className="text-[11px] text-muted-foreground">
                {onAdaptForLocal
                  ? "Barcha tumanlar ulashgan shablonlar — yangi yarating, joyida tahrirlang yoki o'zingizga moslashtiring"
                  : "Global laboratoriya va analiz asosida shablon yarating, ko'ring va tahrirlang"}
              </p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Qidirish..."
                className="bg-secondary border border-border rounded-xl pl-9 pr-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] w-48"
              />
            </div>
            <select
              value={labId}
              onChange={e => handleLabChange(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] max-w-[200px]"
              title="Laboratoriya bo'yicha filter"
            >
              <option value="">Barcha laboratoriyalar</option>
              {laboratories.map(l => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <select
              value={analysisId === "" ? "" : String(analysisId)}
              disabled={!labId}
              onChange={e => handleAnalysisChange(e.target.value)}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] max-w-[220px] disabled:opacity-60"
              title="Analiz bo'yicha filter"
            >
              <option value="">
                {labId ? "Barcha analizlar" : "Avval laboratoriya"}
              </option>
              {labAnalyses.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
            >
              Topish
            </button>
          </form>
          <button
            type="button"
            onClick={() => void load()}
            className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setNewModalOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            <Plus className="h-4 w-4" />
            Yangi shablon
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Shablon", "Analiz", "Yangilangan", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading || loadingView ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <FileType className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Global shablon topilmadi
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          &quot;Yangi shablon&quot; orqali global laboratoriya va analizni tanlab yarating
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr
                    key={item.id}
                    className="border-b border-border hover:bg-secondary/30 transition-colors group cursor-pointer"
                    onClick={() => void openView(item)}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <FileType className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">
                            #{item.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {(() => {
                        const label = globalTemplateAnalysisLabel(item, analyses);
                        return label ? (
                          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <TestTube2 className="w-3.5 h-3.5 shrink-0" />
                            {label}
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {item.updatedAt || item.createdAt
                        ? formatDate(item.updatedAt || item.createdAt || "")
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => void openView(item)}
                          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
                          title="Ko'rish"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void openEdit(item)}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Global shablonni tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        {onAdaptForLocal && (
                          <button
                            type="button"
                            onClick={() => void openAdaptForLocal(item)}
                            className="p-1.5 rounded-lg hover:bg-teal-50 hover:text-teal-600 text-muted-foreground transition-colors"
                            title="O'ziga moslashtirish (online storage)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          disabled={deletingId === item.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors disabled:opacity-50"
                          title="O'chirish"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {total === 0
              ? "0 ta shablon"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                void load({ page: 1 });
              }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const p = Math.max(1, page - 1);
                setPage(p);
                void load({ page: p });
              }}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPage(p as number);
                      void load({ page: p as number });
                    }}
                    disabled={loading}
                    className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                    style={
                      page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                    }
                  >
                    {p}
                  </button>
                ),
              )}
            <button
              type="button"
              onClick={() => {
                const p = Math.min(totalPages, page + 1);
                setPage(p);
                void load({ page: p });
              }}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(totalPages);
                void load({ page: totalPages });
              }}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => !deletingId && setDeleteTarget(null)}
          />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">
                Global shablonni o&apos;chirish
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{deleteTarget.name}</span>
                {" "}ni o&apos;chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deletingId != null}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deletingId != null}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {deletingId != null && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {newModalOpen && (
        <NewTemplateModal
          laboratories={pickerLabs}
          analyses={pickerAnalyses}
          primaryColor={primaryColor}
          title="Yangi global PDF shablon"
          description="Global laboratoriya va analizni tanlang"
          confirmLabel="Davom etish"
          onConfirm={handleConfirmNew}
          onClose={() => setNewModalOpen(false)}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-3.5 h-3.5" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
