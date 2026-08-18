import * as React from "react";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Edit3,
  FlaskConical,
  Globe2,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  TestTube2,
  Trash2,
  X,
} from "lucide-react";
import { ApiError } from "@/api/client";
import {
  addBaseLaboratory,
  deleteBaseLaboratory,
  getAllBaseLaboratories,
  getBaseLaboratoriesFull,
  updateBaseLaboratory,
  type BaseLaboratory,
} from "@/api/baseLaboratory";
import {
  addBaseAnalysis,
  deleteBaseAnalysis,
  getBaseAnalysesFull,
  updateBaseAnalysis,
  type BaseAnalysis,
  type BaseAnalysisPayload,
} from "@/api/baseAnalysis";
import { formatDate } from "@/lib/formatDate";

const PER_PAGE = 10;
type Toast = { id: number; text: string; type: "success" | "error" };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = (text: string, type: Toast["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(items => [...items, { id, text, type }]);
    window.setTimeout(() => setToasts(items => items.filter(item => item.id !== id)), 3000);
  };
  return { toasts, push };
}

function Toasts({ items }: { items: Toast[] }) {
  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium pointer-events-auto ${
            item.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {item.type === "success"
            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
            : <AlertCircle className="w-4 h-4 text-red-500" />}
          {item.text}
        </div>
      ))}
    </div>
  );
}

function SearchToolbar({
  value,
  loading,
  placeholder,
  addLabel,
  primaryColor,
  onChange,
  onSearch,
  onRefresh,
  onAdd,
}: {
  value: string;
  loading: boolean;
  placeholder: string;
  addLabel: string;
  primaryColor: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onRefresh: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
      <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[200px]">
        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
        <input
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => { if (event.key === "Enter") onSearch(); }}
          placeholder={placeholder}
          className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <button type="button" onClick={onSearch} className="px-3.5 py-2.5 rounded-xl border border-border text-[13px] font-medium hover:bg-secondary">
        Qidirish
      </button>
      <button type="button" onClick={onRefresh} title="Yangilash" className="p-2.5 rounded-xl border border-border text-muted-foreground hover:bg-secondary">
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
      </button>
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold hover:opacity-90"
        style={{ background: primaryColor }}
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}

function Pager({
  page,
  total,
  loading,
  noun,
  primaryColor,
  onPage,
}: {
  page: number;
  total: number;
  loading: boolean;
  noun: string;
  primaryColor: string;
  onPage: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1)
    .filter(item => item === 1 || item === totalPages || Math.abs(item - page) <= 1)
    .reduce<(number | "…")[]>((result, item, index, list) => {
      if (index && item - list[index - 1] > 1) result.push("…");
      result.push(item);
      return result;
    }, []);

  return (
    <div className="flex items-center justify-between px-5 py-4 border-t border-border">
      <span className="text-xs text-muted-foreground">
        {total === 0 ? `0 ta ${noun}` : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
      </span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1 || loading} onClick={() => onPage(1)} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30">
          <ChevronsLeft className="w-4 h-4" />
        </button>
        <button disabled={page === 1 || loading} onClick={() => onPage(page - 1)} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pages.map((item, index) => item === "…"
          ? <span key={`ellipsis-${index}`} className="px-2 text-xs text-muted-foreground">…</span>
          : (
            <button
              key={item}
              disabled={loading}
              onClick={() => onPage(item)}
              className="w-8 h-8 rounded-lg text-xs font-semibold"
              style={item === page ? { background: primaryColor, color: "#fff" } : undefined}
            >
              {item}
            </button>
          ))}
        <button disabled={page === totalPages || loading} onClick={() => onPage(page + 1)} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30">
          <ChevronLeft className="w-4 h-4 rotate-180" />
        </button>
        <button disabled={page === totalPages || loading} onClick={() => onPage(totalPages)} className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30">
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyRow({ colSpan, loading, label, icon: Icon, primaryColor }: {
  colSpan: number;
  loading: boolean;
  label: string;
  icon: React.ElementType;
  primaryColor: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-16 text-center">
        <div className="flex flex-col items-center gap-3">
          {loading
            ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
            : <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center"><Icon className="w-6 h-6 text-muted-foreground" /></div>}
          <p className="text-sm font-semibold text-foreground">{loading ? "Yuklanmoqda…" : `${label} topilmadi`}</p>
        </div>
      </td>
    </tr>
  );
}

function ModalShell({ title, subtitle, saving, onClose, onSave, children }: {
  title: string;
  subtitle: string;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div><h2 className="font-semibold text-[15px]">{title}</h2><p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p></div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="flex gap-3 px-6 pb-6">
          <button type="button" disabled={saving} onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary">Bekor qilish</button>
          <button type="button" disabled={saving} onClick={onSave} className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ name, noun, saving, onClose, onDelete }: {
  name: string;
  noun: string;
  saving: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4"><Trash2 className="w-6 h-6 text-red-500" /></div>
        <h2 className="text-[16px] font-bold mb-2">{noun} o&apos;chirish</h2>
        <p className="text-[13px] text-muted-foreground"><span className="font-semibold text-foreground">{name}</span> ni o&apos;chirishni xohlaysizmi?</p>
        <div className="flex gap-3 mt-6">
          <button disabled={saving} onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm">Bekor qilish</button>
          <button disabled={saving} onClick={onDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Ha, o&apos;chirish
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-[var(--primary)]";

export function BaseLaboratoriesSection({ primaryColor }: { primaryColor: string }) {
  const [items, setItems] = useState<BaseLaboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: "add" } | { type: "edit" | "delete"; item: BaseLaboratory } | null>(null);
  const [name, setName] = useState("");
  const { toasts, push } = useToasts();

  const load = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getBaseLaboratoriesFull({ page: nextPage, limit: PER_PAGE, search: nextSearch });
      setItems(result.data);
      setTotal(result.total);
      setPage(result.page);
    } catch (err) {
      setError(errorMessage(err, "Global laboratoriyalarni yuklab bo'lmadi"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const openAdd = () => { setName(""); setModal({ type: "add" }); };
  const openEdit = (item: BaseLaboratory) => { setName(item.name); setModal({ type: "edit", item }); };
  const applySearch = () => { setPage(1); setSearch(searchInput.trim()); };

  const save = async () => {
    if (!modal || modal.type === "delete" || name.trim().length < 2) {
      if (name.trim().length < 2) push("Kamida 2 ta belgi kiriting", "error");
      return;
    }
    setSaving(true);
    try {
      if (modal.type === "add") await addBaseLaboratory({ name: name.trim() });
      else await updateBaseLaboratory(modal.item.id, { name: name.trim() });
      push(modal.type === "add" ? "Global laboratoriya qo'shildi" : "Global laboratoriya yangilandi");
      setModal(null);
      if (page !== 1 && modal.type === "add") setPage(1);
      else await load(modal.type === "add" ? 1 : page);
    } catch (err) {
      push(errorMessage(err, "Saqlashda xatolik"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteBaseLaboratory(modal.item.id);
      push("Global laboratoriya o'chirildi");
      setModal(null);
      const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage); else await load(nextPage);
    } catch (err) {
      push(errorMessage(err, "O'chirishda xatolik"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <SearchToolbar value={searchInput} loading={loading} placeholder="Global laboratoriya nomi bo'yicha qidirish…" addLabel="Global laboratoriya" primaryColor={primaryColor} onChange={setSearchInput} onSearch={applySearch} onRefresh={() => void load()} onAdd={openAdd} />
        {error && <div className="mx-5 mt-4 flex gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/40">{["Global laboratoriya", "Analizlar", "Yaratilgan", ""].map(label => <th key={label} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">{label}</th>)}</tr></thead>
            <tbody>
              {(loading || !items.length) ? <EmptyRow colSpan={4} loading={loading} label="Global laboratoriya" icon={FlaskConical} primaryColor={primaryColor} /> : items.map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-secondary/30 group">
                  <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl text-white flex items-center justify-center" style={{ background: primaryColor }}><Globe2 className="w-4 h-4" /></div><div><div className="text-[13px] font-semibold">{item.name}</div><div className="text-[11px] text-muted-foreground font-mono">#{item.id}</div></div></div></td>
                  <td className="px-5 py-3.5 text-[12px] text-muted-foreground">{item.analysis?.length ?? 0} ta</td>
                  <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">{item.createdAt ? formatDate(item.createdAt) : "—"}</td>
                  <td className="px-5 py-3.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => openEdit(item)} title="Tahrirlash" className="p-1.5 rounded-lg hover:bg-violet-50 text-muted-foreground hover:text-violet-600"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={() => setModal({ type: "delete", item })} title="O'chirish" className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} loading={loading} noun="global laboratoriya" primaryColor={primaryColor} onPage={setPage} />
      </div>
      {(modal?.type === "add" || modal?.type === "edit") && <ModalShell title={modal.type === "add" ? "Yangi global laboratoriya" : "Global laboratoriyani tahrirlash"} subtitle="Bu laboratoriya barcha kompaniyalarda mavjud bo'ladi" saving={saving} onClose={() => setModal(null)} onSave={() => void save()}><label className="block text-xs font-semibold">Nomi *</label><input autoFocus value={name} onChange={event => setName(event.target.value)} className={inputClass} placeholder="Laboratoriya nomi" /></ModalShell>}
      {modal?.type === "delete" && <DeleteModal name={modal.item.name} noun="Global laboratoriyani" saving={saving} onClose={() => setModal(null)} onDelete={() => void remove()} />}
      <Toasts items={toasts} />
    </div>
  );
}

type AnalysisForm = { name: string; shortname: string; price: string; baselaboratory_id: number | "" };
const EMPTY_ANALYSIS: AnalysisForm = { name: "", shortname: "", price: "", baselaboratory_id: "" };

export function BaseAnalysesSection({ primaryColor }: { primaryColor: string }) {
  const [items, setItems] = useState<BaseAnalysis[]>([]);
  const [laboratories, setLaboratories] = useState<BaseLaboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: "add" } | { type: "edit" | "delete"; item: BaseAnalysis } | null>(null);
  const [form, setForm] = useState<AnalysisForm>(EMPTY_ANALYSIS);
  const { toasts, push } = useToasts();

  const load = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    setError(null);
    try {
      const [result, labsResult] = await Promise.all([
        getBaseAnalysesFull({ page: nextPage, limit: PER_PAGE, search: nextSearch }),
        getAllBaseLaboratories(),
      ]);
      setItems(result.data);
      setTotal(result.total);
      setPage(result.page);
      setLaboratories(labsResult);
    } catch (err) {
      setError(errorMessage(err, "Global analizlarni yuklab bo'lmadi"));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [page, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateForm = <K extends keyof AnalysisForm>(key: K, value: AnalysisForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const applySearch = () => { setPage(1); setSearch(searchInput.trim()); };
  const openEdit = (item: BaseAnalysis) => {
    setForm({ name: item.name, shortname: item.shortname, price: item.price, baselaboratory_id: item.baselaboratory?.id ?? item.baselaboratory_id ?? "" });
    setModal({ type: "edit", item });
  };

  const save = async () => {
    if (!modal || modal.type === "delete") return;
    const labId = Number(form.baselaboratory_id);
    if (form.name.trim().length < 2 || !form.shortname.trim() || !form.price.trim() || !Number.isFinite(Number(form.price)) || labId <= 0) {
      push("Barcha majburiy maydonlarni to'g'ri to'ldiring", "error");
      return;
    }
    const payload: BaseAnalysisPayload = {
      name: form.name.trim(),
      shortname: form.shortname.trim(),
      price: form.price.trim(),
      globalstorage: modal.type === "edit" ? modal.item.globalstorage : false,
      baselaboratory_id: labId,
    };
    setSaving(true);
    try {
      if (modal.type === "add") await addBaseAnalysis(payload);
      else await updateBaseAnalysis(modal.item.id, payload);
      push(modal.type === "add" ? "Global analiz qo'shildi" : "Global analiz yangilandi");
      setModal(null);
      if (page !== 1 && modal.type === "add") setPage(1);
      else await load(modal.type === "add" ? 1 : page);
    } catch (err) {
      push(errorMessage(err, "Saqlashda xatolik"), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteBaseAnalysis(modal.item.id);
      push("Global analiz o'chirildi");
      setModal(null);
      const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage); else await load(nextPage);
    } catch (err) {
      push(errorMessage(err, "O'chirishda xatolik"), "error");
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (value: string) => Number.isFinite(Number(value)) ? `${Number(value).toLocaleString("uz-UZ")} so'm` : value;

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <SearchToolbar value={searchInput} loading={loading} placeholder="Global analiz nomi bo'yicha qidirish…" addLabel="Global analiz" primaryColor={primaryColor} onChange={setSearchInput} onSearch={applySearch} onRefresh={() => void load()} onAdd={() => { setForm(EMPTY_ANALYSIS); setModal({ type: "add" }); }} />
        {error && <div className="mx-5 mt-4 flex gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/40">{["Global analiz", "Qisqa nom", "Narx", "Global laboratoriya", "Yaratilgan", ""].map(label => <th key={label} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3">{label}</th>)}</tr></thead>
            <tbody>
              {(loading || !items.length) ? <EmptyRow colSpan={6} loading={loading} label="Global analiz" icon={TestTube2} primaryColor={primaryColor} /> : items.map(item => (
                <tr key={item.id} className="border-b border-border hover:bg-secondary/30 group">
                  <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl text-white flex items-center justify-center" style={{ background: primaryColor }}><Globe2 className="w-4 h-4" /></div><div><div className="text-[13px] font-semibold">{item.name}</div><div className="text-[11px] text-muted-foreground font-mono">#{item.id}</div></div></div></td>
                  <td className="px-5 py-3.5"><span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold font-mono" style={{ background: `${primaryColor}15`, color: primaryColor }}>{item.shortname}</span></td>
                  <td className="px-5 py-3.5 text-[13px] font-semibold whitespace-nowrap">{formatPrice(item.price)}</td>
                  <td className="px-5 py-3.5 text-[12px] text-muted-foreground"><span className="inline-flex items-center gap-1.5"><FlaskConical className="w-3.5 h-3.5" />{item.baselaboratory?.name || "—"}</span></td>
                  <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">{item.createdAt ? formatDate(item.createdAt) : "—"}</td>
                  <td className="px-5 py-3.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => openEdit(item)} title="Tahrirlash" className="p-1.5 rounded-lg hover:bg-violet-50 text-muted-foreground hover:text-violet-600"><Edit3 className="w-3.5 h-3.5" /></button><button onClick={() => setModal({ type: "delete", item })} title="O'chirish" className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} total={total} loading={loading} noun="global analiz" primaryColor={primaryColor} onPage={setPage} />
      </div>
      {(modal?.type === "add" || modal?.type === "edit") && (
        <ModalShell title={modal.type === "add" ? "Yangi global analiz" : "Global analizni tahrirlash"} subtitle="Bu analiz barcha kompaniyalarda mavjud bo'ladi" saving={saving} onClose={() => setModal(null)} onSave={() => void save()}>
          <div><label className="block text-xs font-semibold mb-1.5">Nomi *</label><input autoFocus value={form.name} onChange={event => updateForm("name", event.target.value)} className={inputClass} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold mb-1.5">Qisqa nom *</label><input value={form.shortname} onChange={event => updateForm("shortname", event.target.value)} className={inputClass} /></div>
            <div><label className="block text-xs font-semibold mb-1.5">Narx *</label><input inputMode="numeric" value={form.price} onChange={event => updateForm("price", event.target.value.replace(/[^\d.]/g, ""))} className={inputClass} /></div>
          </div>
          <div><label className="block text-xs font-semibold mb-1.5">Global laboratoriya *</label><select value={form.baselaboratory_id} onChange={event => updateForm("baselaboratory_id", event.target.value ? Number(event.target.value) : "")} className={inputClass}><option value="">Laboratoriya tanlang</option>{laboratories.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}</select></div>
        </ModalShell>
      )}
      {modal?.type === "delete" && <DeleteModal name={modal.item.name} noun="Global analizni" saving={saving} onClose={() => setModal(null)} onDelete={() => void remove()} />}
      <Toasts items={toasts} />
    </div>
  );
}
