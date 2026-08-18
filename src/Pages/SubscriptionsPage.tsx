import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle, ChevronLeft, Edit3, Loader2, Plus,
  RefreshCw, Search, Trash2, WalletCards, X,
} from "lucide-react";
import { getAllCompanies, type Company } from "@/api/company";
import { getAllPlans, type Plan } from "@/api/plan";
import {
  addSubscription, deleteSubscription, getSubscriptionsFull, updateSubscription,
  type Subscription, type SubscriptionPayload, type SubscriptionStatus,
} from "@/api/subscription";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

const LIMIT = 10;
type Toast = { id: number; text: string; type: "success" | "error" };
type Form = {
  company_id: number | "";
  plan_id: number | "";
  startDate: string;
  dueDate: string;
  status: SubscriptionStatus;
};
type Modal =
  | { type: "add" }
  | { type: "edit" | "delete"; subscription: Subscription }
  | null;

function localDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getCompanyId(item: Subscription): number | "" {
  return item.company?.id ?? item.company_id ?? item.companyId ?? "";
}

function getPlanId(item: Subscription): number | "" {
  return item.plan?.id ?? item.plan_id ?? item.planId ?? "";
}

function SubscriptionModal({
  initial, companies, plans, saving, primaryColor, title, onSave, onClose,
}: {
  initial: Form;
  companies: Company[];
  plans: Plan[];
  saving: boolean;
  primaryColor: string;
  title: string;
  onSave: (payload: SubscriptionPayload) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Form>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputClass = (error?: string) =>
    `w-full rounded-xl border bg-secondary px-3.5 py-2.5 text-[13px] text-foreground outline-none ${
      error ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;
  const submit = () => {
    const next: Record<string, string> = {};
    if (form.company_id === "") next.company_id = "Tashkilotni tanlang";
    if (form.plan_id === "") next.plan_id = "Tarifni tanlang";
    if (!form.startDate) next.startDate = "Boshlanish sanasini kiriting";
    if (!form.dueDate) next.dueDate = "Tugash sanasini kiriting";
    if (form.startDate && form.dueDate && new Date(form.dueDate) <= new Date(form.startDate)) {
      next.dueDate = "Tugash sanasi boshlanishdan keyin bo'lishi kerak";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    onSave({
      company_id: Number(form.company_id),
      plan_id: Number(form.plan_id),
      startDate: new Date(form.startDate).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      status: form.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div><h2 className="text-[15px] font-semibold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">Tashkilotga tarif biriktiring</p></div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Tashkilot *</label>
              <select value={form.company_id} onChange={e => setForm(f => ({ ...f, company_id: e.target.value ? Number(e.target.value) : "" }))} className={inputClass(errors.company_id)}>
                <option value="">Tanlang</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.company_id && <p className="mt-1 text-[11px] text-red-500">{errors.company_id}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Tarif *</label>
              <select value={form.plan_id} onChange={e => setForm(f => ({ ...f, plan_id: e.target.value ? Number(e.target.value) : "" }))} className={inputClass(errors.plan_id)}>
                <option value="">Tanlang</option>
                {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}
              </select>
              {errors.plan_id && <p className="mt-1 text-[11px] text-red-500">{errors.plan_id}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Boshlanish sanasi *</label>
              <input type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} className={inputClass(errors.startDate)} />
              {errors.startDate && <p className="mt-1 text-[11px] text-red-500">{errors.startDate}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Tugash sanasi *</label>
              <input type="datetime-local" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className={inputClass(errors.dueDate)} />
              {errors.dueDate && <p className="mt-1 text-[11px] text-red-500">{errors.dueDate}</p>}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Holat *</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SubscriptionStatus }))} className={inputClass()}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="EXPIRED">EXPIRED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} disabled={saving} className="flex-1 rounded-xl border border-border py-2.5 text-sm hover:bg-secondary">Bekor qilish</button>
          <button onClick={submit} disabled={saving} style={{ background: primaryColor }} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Saqlash</button>
        </div>
      </div>
    </div>
  );
}

export function SubscriptionsPage({ primaryColor }: { primaryColor: string }) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const toast = (text: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts(v => [...v, { id, text, type }]);
    setTimeout(() => setToasts(v => v.filter(t => t.id !== id)), 3000);
  };
  const load = async (nextPage = page, nextSearch = search) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSubscriptionsFull({ page: nextPage, limit: LIMIT, search: nextSearch });
      setSubscriptions(result.data);
      setTotal(result.total);
      setPage(result.page);
    } catch (e) {
      setSubscriptions([]);
      setTotal(0);
      setError(e instanceof ApiError ? e.message : "Obunalarni yuklab bo'lmadi");
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [page, search]);
  useEffect(() => {
    void Promise.all([getAllCompanies(), getAllPlans()])
      .then(([companyData, planData]) => {
        setCompanies(Array.isArray(companyData) ? companyData : []);
        setPlans(planData);
      })
      .catch(() => toast("Tashkilot yoki tariflar ro'yxatini yuklab bo'lmadi", "error"));
  }, []);

  const companyMap = useMemo(() => new Map(companies.map(c => [c.id, c.name])), [companies]);
  const planMap = useMemo(() => new Map(plans.map(p => [p.id, p.name])), [plans]);
  const applySearch = () => { setPage(1); setSearch(searchInput.trim()); };

  const save = async (payload: SubscriptionPayload) => {
    if (!modal || modal.type === "delete") return;
    setSaving(true);
    try {
      if (modal.type === "add") await addSubscription(payload);
      else await updateSubscription(modal.subscription.id, payload);
      toast(modal.type === "add" ? "Obuna qo'shildi" : "Obuna yangilandi");
      setModal(null);
      await load();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Saqlashda xatolik", "error"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteSubscription(modal.subscription.id);
      toast("Obuna o'chirildi");
      setModal(null);
      const target = subscriptions.length === 1 && page > 1 ? page - 1 : page;
      if (target !== page) setPage(target); else await load(target);
    } catch (e) { toast(e instanceof ApiError ? e.message : "O'chirishda xatolik", "error"); }
    finally { setSaving(false); }
  };

  const emptyForm: Form = {
    company_id: "", plan_id: "",
    startDate: localDateTime(new Date().toISOString()),
    dueDate: "",
    status: "ACTIVE",
  };

  return (
    <main className="ses-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") applySearch(); }} placeholder="Tashkilot yoki tarif bo'yicha…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          </div>
          <button onClick={applySearch} className="rounded-xl border border-border px-3.5 py-2.5 text-[13px] font-medium hover:bg-secondary">Qidirish</button>
          <button onClick={() => void load()} className="rounded-xl border border-border p-2.5 text-muted-foreground hover:bg-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          <button onClick={() => setModal({ type: "add" })} style={{ background: primaryColor }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" />Yangi obuna</button>
        </div>
        {error && <div className="mx-5 mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/40">{["Tashkilot", "Tarif", "Boshlanish", "Tugash", "Holat", ""].map(h => <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" style={{ color: primaryColor }} /></td></tr>
                : !subscriptions.length ? <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground"><WalletCards className="mx-auto mb-3 h-7 w-7" />Obuna topilmadi</td></tr>
                  : subscriptions.map(item => {
                    const companyId = getCompanyId(item);
                    const planId = getPlanId(item);
                    const statusClass =
                      item.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.status === "PENDING"
                          ? "bg-amber-50 text-amber-700"
                          : item.status === "EXPIRED"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-red-50 text-red-600";
                    return <tr key={item.id} className="group border-b border-border hover:bg-secondary/30">
                      <td className="px-5 py-3.5 text-[13px] font-semibold">{item.company?.name ?? (companyId === "" ? "—" : companyMap.get(companyId) ?? `#${companyId}`)}</td>
                      <td className="px-5 py-3.5 text-[12px]">{item.plan?.name ?? (planId === "" ? "—" : planMap.get(planId) ?? `#${planId}`)}</td>
                      <td className="whitespace-pre-line px-5 py-3.5 text-[12px] text-muted-foreground">{formatDate(item.startDate)}</td>
                      <td className="whitespace-pre-line px-5 py-3.5 text-[12px] text-muted-foreground">{formatDate(item.dueDate)}</td>
                      <td className="px-5 py-3.5"><span className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${statusClass}`}>{item.status}</span></td>
                      <td className="px-5 py-3.5"><div className="flex gap-1 opacity-0 group-hover:opacity-100"><button onClick={() => setModal({ type: "edit", subscription: item })} className="p-1.5 text-muted-foreground hover:text-violet-600"><Edit3 className="h-3.5 w-3.5" /></button><button onClick={() => setModal({ type: "delete", subscription: item })} className="p-1.5 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                    </tr>;
                  })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-xs text-muted-foreground">{total ? `${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} / ${total} ta` : "0 ta obuna"}</span>
          <div className="flex items-center gap-2"><button disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg p-2 text-muted-foreground disabled:opacity-30 hover:bg-secondary"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs font-semibold">{page} / {totalPages}</span><button disabled={page === totalPages || loading} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="rounded-lg p-2 text-muted-foreground disabled:opacity-30 hover:bg-secondary"><ChevronLeft className="h-4 w-4 rotate-180" /></button></div>
        </div>
      </div>

      {modal?.type === "add" && <SubscriptionModal initial={emptyForm} companies={companies} plans={plans} saving={saving} primaryColor={primaryColor} title="Yangi obuna" onSave={save} onClose={() => setModal(null)} />}
      {modal?.type === "edit" && <SubscriptionModal initial={{ company_id: getCompanyId(modal.subscription), plan_id: getPlanId(modal.subscription), startDate: localDateTime(modal.subscription.startDate), dueDate: localDateTime(modal.subscription.dueDate), status: modal.subscription.status as SubscriptionStatus }} companies={companies} plans={plans} saving={saving} primaryColor={primaryColor} title="Obunani tahrirlash" onSave={save} onClose={() => setModal(null)} />}
      {modal?.type === "delete" && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/45" onClick={() => setModal(null)} /><div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"><Trash2 className="mx-auto mb-4 h-8 w-8 text-red-500" /><h2 className="font-bold">Obunani o&apos;chirish</h2><p className="my-3 text-[13px] text-muted-foreground">Ushbu obunani o&apos;chirasizmi?</p><div className="flex gap-3"><button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm">Bekor qilish</button><button disabled={saving} onClick={() => void remove()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />}O&apos;chirish</button></div></div></div>}
      <div className="fixed bottom-6 right-6 z-[60] space-y-2">{toasts.map(t => <div key={t.id} className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-xl ${t.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{t.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{t.text}</div>)}</div>
    </main>
  );
}
