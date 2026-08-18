import * as React from "react";
import { useEffect, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw, TestTube2,
  CheckCircle, AlertCircle, Loader2, FlaskConical, FileText,
  ChevronLeft, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import {
  getAllAnalyses,
  getAnalysesFull,
  addAnalysis,
  updateAnalysis,
  deleteAnalysis,
  analysisHasOnlineStorage,
  type Analysis,
  type AnalysisPayload,
} from "@/api/analysis";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { getCompanyById, type Company } from "@/api/company";
import { getStoredCompanyId } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type AnalysisForm = {
  name: string;
  shortname: string;
  price: string;
  laboratory_id: number | "";
};

const EMPTY_FORM: AnalysisForm = {
  name: "",
  shortname: "",
  price: "",
  laboratory_id: "",
};

const PER_PAGE = 10;

function laboratoryCompanyId(lab: Laboratory): number | null {
  const value = lab.company?.id ?? lab.company_id ?? lab.companyId;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function companyLaboratories(company: Company): Laboratory[] {
  const raw = company as Company & {
    laboratory?: unknown;
    laboratories?: unknown;
    labs?: unknown;
  };
  const candidate = raw.laboratory ?? raw.laboratories ?? raw.labs;
  return Array.isArray(candidate) ? candidate as Laboratory[] : [];
}

function scopeLaboratories(allLabs: Laboratory[], company: Company | null, companyId: number): Laboratory[] {
  const fromApi = Array.isArray(allLabs) ? allLabs : [];
  const matching = fromApi.filter(lab => {
    const cid = laboratoryCompanyId(lab);
    return cid == null || cid === companyId;
  });
  if (matching.length > 0) return matching;
  return company ? companyLaboratories(company) : [];
}

function formatPrice(price: unknown) {
  const n = Number(price);
  if (Number.isFinite(n)) {
    return n.toLocaleString("uz-UZ") + " so'm";
  }
  if (price == null || price === "") return "—";
  return String(price);
}

function AnalysisFormModal({
  mode,
  initial,
  laboratories,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  initial: AnalysisForm;
  laboratories: Laboratory[];
  primaryColor: string;
  saving: boolean;
  onSave: (data: AnalysisForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AnalysisForm>({
    name: String(initial.name ?? ""),
    shortname: String(initial.shortname ?? ""),
    price: String(initial.price ?? ""),
    laboratory_id: initial.laboratory_id,
  });
  const [errors, setErrors] = useState<Partial<Record<keyof AnalysisForm, string>>>({});

  const set = <K extends keyof AnalysisForm>(k: K, v: AnalysisForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof AnalysisForm, string>> = {};
    const name = String(form.name ?? "").trim();
    const shortname = String(form.shortname ?? "").trim();
    const price = String(form.price ?? "").trim();
    if (!name || name.length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!shortname) e.shortname = "Qisqa nom kiritilishi shart";
    if (!price || Number.isNaN(Number(price)) || Number(price) < 0) {
      e.price = "To'g'ri narx kiriting";
    }
    if (form.laboratory_id === "" || form.laboratory_id == null) e.laboratory_id = "Laboratoriya tanlang";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">
              {mode === "add" ? "Yangi analiz" : "Analizni tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "add" ? "Barcha majburiy maydonlarni to'ldiring" : "Ma'lumotlarni yangilang"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
            <input
              type="text"
              value={form.name}
              placeholder="Bakterologiya"
              onChange={e => set("name", e.target.value)}
              className={inputCls(errors.name)}
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Qisqa nom *</label>
              <input
                type="text"
                value={form.shortname}
                placeholder="VLOGY"
                onChange={e => set("shortname", e.target.value)}
                className={inputCls(errors.shortname)}
              />
              {errors.shortname && <p className="text-[11px] text-red-500 mt-1">{errors.shortname}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Narx *</label>
              <input
                type="text"
                inputMode="numeric"
                value={form.price}
                placeholder="30000"
                onChange={e => set("price", e.target.value.replace(/[^\d.]/g, ""))}
                className={inputCls(errors.price)}
              />
              {errors.price && <p className="text-[11px] text-red-500 mt-1">{errors.price}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Laboratoriya *</label>
            <select
              value={form.laboratory_id === "" ? "" : String(form.laboratory_id)}
              onChange={e => {
                const raw = e.target.value;
                set("laboratory_id", raw ? Number(raw) : "");
              }}
              className={inputCls(errors.laboratory_id)}
            >
              <option value="">Laboratoriya tanlang</option>
              {laboratories.map(lab => (
                <option key={lab.id} value={String(lab.id)}>{lab.name}</option>
              ))}
            </select>
            {errors.laboratory_id && <p className="text-[11px] text-red-500 mt-1">{errors.laboratory_id}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-border">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => { if (validate()) onSave(form); }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Qo'shish" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AnalysesSection({
  primaryColor,
  onOpenPdfTemplate,
  companyId,
}: {
  primaryColor: string;
  onOpenPdfTemplate?: (item: Analysis) => void;
  companyId?: number;
}) {
  const scopedCompanyId = companyId ?? getStoredCompanyId() ?? undefined;
  const [items, setItems] = useState<Analysis[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [labId, setLabId] = useState<number | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; item: Analysis }
    | { type: "delete"; item: Analysis }
    | null
  >(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadItems = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      if (scopedCompanyId != null) {
        const [allItems, allLabs, company] = await Promise.all([
          getAllAnalyses(scopedCompanyId),
          getAllLaboratories(scopedCompanyId),
          getCompanyById(scopedCompanyId),
        ]);
        const scopedLabs = scopeLaboratories(allLabs, company, scopedCompanyId);
        const labIds = new Set(scopedLabs.map(lab => lab.id));
        const query = s.trim().toLowerCase();
        const scopedItems = allItems.filter(item => {
          if (item.laboratory?.id != null && labIds.size > 0 && !labIds.has(item.laboratory.id)) return false;
          return !query
            || item.name.toLowerCase().includes(query)
            || item.shortname.toLowerCase().includes(query);
        });
        const start = (p - 1) * PER_PAGE;
        setLaboratories(scopedLabs);
        setItems(scopedItems.slice(start, start + PER_PAGE));
        setTotal(scopedItems.length);
        setPage(p);
        return;
      }

      const res = await getAnalysesFull({
        page: p,
        limit: PER_PAGE,
        search: s,
        companyId: scopedCompanyId,
      });
      setItems(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analizlarni yuklab bo'lmadi");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        if (scopedCompanyId != null) {
          const [list, company] = await Promise.all([
            getAllLaboratories(scopedCompanyId),
            getCompanyById(scopedCompanyId),
          ]);
          setLaboratories(scopeLaboratories(list, company, scopedCompanyId));
        } else {
          const list = await getAllLaboratories();
          setLaboratories(Array.isArray(list) ? list : []);
        }
      } catch {
        setLaboratories([]);
      }
    })();
  }, [scopedCompanyId]);

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, scopedCompanyId]);

  const applySearch = () => {
    setPage(1);
    setLabId("");
    setSearch(searchInput.trim());
  };

  const handleSave = async (form: AnalysisForm) => {
    if (!modal || (modal.type !== "add" && modal.type !== "edit")) return;

    const laboratoryId = Number(form.laboratory_id);
    if (!Number.isFinite(laboratoryId) || laboratoryId <= 0) {
      pushToast("Laboratoriya tanlang", "error");
      return;
    }

    const payload: AnalysisPayload = {
      name: String(form.name ?? "").trim(),
      shortname: String(form.shortname ?? "").trim(),
      price: String(form.price ?? "").trim(),
      laboratory_id: laboratoryId,
      ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
    };

    setSaving(true);
    try {
      if (modal.type === "add") {
        await addAnalysis(payload);
        pushToast(`${payload.name} qo'shildi`);
        setModal(null);
        if (page !== 1) setPage(1);
        else await loadItems({ page: 1 });
      } else {
        // Edit: laboratory_id ham majburiy — laboratoriya o'zgartirilganda PATCH bodyda ketadi
        await updateAnalysis(modal.item.id, {
          name: payload.name,
          shortname: payload.shortname,
          price: payload.price,
          laboratory_id: payload.laboratory_id,
          ...(scopedCompanyId != null ? { company_id: scopedCompanyId } : {}),
        });
        pushToast(`${payload.name} yangilandi`);
        setModal(null);
        await loadItems({ page });
      }
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteAnalysis(modal.item.id, scopedCompanyId);
      pushToast(`${modal.item.name} o'chirildi`, "error");
      setModal(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadItems({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Nomi yoki qisqa nom bo'yicha qidirish…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                  setLabId("");
                  setPage(1);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={labId === "" ? "" : String(labId)}
            onChange={e => {
              const id = e.target.value ? Number(e.target.value) : "";
              setPage(1);
              setLabId(id);
              if (id === "") {
                setSearchInput("");
                setSearch("");
                return;
              }
              const lab = laboratories.find(l => l.id === id);
              const name = lab?.name?.trim() ?? "";
              setSearchInput(name);
              setSearch(name);
            }}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none max-w-[200px]"
          >
            <option value="">Barcha laboratoriyalar</option>
            {laboratories.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <button
            onClick={applySearch}
            className="px-3.5 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Qidirish
          </button>

          <button
            onClick={() => void loadItems()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setModal({ type: "add" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" />
            Yangi analiz
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
                {["Analiz", "Qisqa nom", "Narx", "Laboratoriya", "Shablon", "Yaratilgan", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <TestTube2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Analiz topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Yangi analiz qo'shing yoki qidiruvni o'zgartiring</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr key={item.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <TestTube2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {item.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">#{item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono"
                        style={{ background: `${primaryColor}15`, color: primaryColor }}
                      >
                        {item.shortname}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] font-semibold text-foreground whitespace-nowrap">
                      {formatPrice(item.price)}
                    </td>
                    <td className="px-5 py-3.5">
                      {item.laboratory ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                          <FlaskConical className="w-3.5 h-3.5 shrink-0" />
                          {item.laboratory.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {analysisHasOnlineStorage(item) ? (
                        <button
                          type="button"
                          onClick={() => onOpenPdfTemplate?.(item)}
                          title="PDF shablonni ochish"
                          className="inline-flex p-1.5 -m-1.5 rounded-lg hover:bg-secondary transition-colors"
                        >
                          <FileText
                            className="w-4 h-4"
                            style={{ color: primaryColor }}
                          />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenPdfTemplate?.(item)}
                          title="Yangi PDF shablon yaratish"
                          className="text-[11px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 -mx-1.5 rounded-lg hover:bg-secondary transition-colors whitespace-nowrap"
                        >
                          shabloni yo&apos;q
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "edit", item })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", item })}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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
              ? "0 ta analiz"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
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
                p === "…"
                  ? <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                      }
                    >
                      {p}
                    </button>
                  ),
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modal?.type === "add" && (
        <AnalysisFormModal
          mode="add"
          initial={EMPTY_FORM}
          laboratories={laboratories}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <AnalysisFormModal
          key={`edit-${modal.item.id}`}
          mode="edit"
          initial={{
            name: String(modal.item.name ?? ""),
            shortname: String(modal.item.shortname ?? ""),
            price: String(modal.item.price ?? ""),
            laboratory_id:
              modal.item.laboratory?.id != null && Number(modal.item.laboratory.id) > 0
                ? Number(modal.item.laboratory.id)
                : "",
          }}
          laboratories={laboratories}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Analizni o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{modal.item.name}</span>
                {" "}ni o'chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-fade-in pointer-events-auto ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            }
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
