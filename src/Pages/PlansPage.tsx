import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle, Edit3, Loader2, Package, Plus,
  RefreshCw, Search, Trash2, X,
} from "lucide-react";
import {
  addPlan, deletePlan, getAllPlans, updatePlan,
  type Plan, type PlanPayload,
} from "@/api/plan";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { getStoredUser } from "@/api/session";
import { normalizeRoleName } from "@/lib/roles";

type Toast = { id: number; text: string; type: "success" | "error" };
type Modal = { type: "add" } | { type: "edit" | "delete"; plan: Plan } | null;

function canManagePlans(): boolean {
  return normalizeRoleName(getStoredUser()?.role?.name) === "super_admin";
}

/** Faqat raqamlarni qoldiradi (so'm uchun butun son). */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** 1000000 → "1 000 000" */
function formatSomInput(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Jadvalda ko'rsatish: "1 000 000 so'm" */
function formatSomDisplay(value: string | number | null | undefined): string {
  const digits = digitsOnly(String(value ?? ""));
  if (!digits) return "—";
  return `${formatSomInput(digits)} so'm`;
}

const EMPTY: PlanPayload = {
  name: "",
  description: "",
  price: "",
  billingCycle: "monthly",
};

function PlanModal({
  initial, saving, primaryColor, title, onSave, onClose,
}: {
  initial: PlanPayload;
  saving: boolean;
  primaryColor: string;
  title: string;
  onSave: (payload: PlanPayload) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    ...initial,
    price: formatSomInput(String(initial.price ?? "")),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputClass = (error?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none ${
      error ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  const submit = () => {
    const rawPrice = digitsOnly(form.price);
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = "Kamida 2 ta belgi kiriting";
    if (!form.description.trim()) next.description = "Tavsif kiriting";
    if (!rawPrice || !Number.isFinite(Number(rawPrice)) || Number(rawPrice) < 0) {
      next.price = "To'g'ri narx kiriting";
    }
    setErrors(next);
    if (!Object.keys(next).length) {
      onSave({
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        price: rawPrice,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Tarif ma&apos;lumotlarini kiriting</p>
          </div>
          <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Nomi *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputClass(errors.name)} placeholder="Masalan: Start" />
            {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold">Tavsif *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={`${inputClass(errors.description)} resize-none`} rows={3} />
            {errors.description && <p className="mt-1 text-[11px] text-red-500">{errors.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Narxi (so&apos;m) *</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: formatSomInput(e.target.value) }))}
                  className={`${inputClass(errors.price)} pr-12`}
                  placeholder="1 000 000"
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">
                  so&apos;m
                </span>
              </div>
              {errors.price && <p className="mt-1 text-[11px] text-red-500">{errors.price}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold">Davri *</label>
              <select value={form.billingCycle} onChange={e => setForm(f => ({ ...f, billingCycle: e.target.value as PlanPayload["billingCycle"] }))} className={inputClass()}>
                <option value="monthly">Oylik</option>
                <option value="yearly">Yillik</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button disabled={saving} onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-secondary">Bekor qilish</button>
          <button disabled={saving} onClick={submit} style={{ background: primaryColor }} className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

export function PlansPage({ primaryColor }: { primaryColor: string }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const canManage = canManagePlans();

  const toast = (text: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts(v => [...v, { id, text, type }]);
    setTimeout(() => setToasts(v => v.filter(t => t.id !== id)), 3000);
  };
  const load = async () => {
    setLoading(true);
    setError(null);
    try { setPlans(await getAllPlans()); }
    catch (e) { setPlans([]); setError(e instanceof ApiError ? e.message : "Tariflarni yuklab bo'lmadi"); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter(p => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [plans, search]);

  const save = async (payload: PlanPayload) => {
    if (!canManage || !modal || modal.type === "delete") return;
    setSaving(true);
    try {
      if (modal.type === "add") await addPlan(payload);
      else await updatePlan(modal.plan.id, payload);
      toast(modal.type === "add" ? "Tarif qo'shildi" : "Tarif yangilandi");
      setModal(null);
      await load();
    } catch (e) { toast(e instanceof ApiError ? e.message : "Saqlashda xatolik", "error"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!canManage || modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deletePlan(modal.plan.id);
      toast("Tarif o'chirildi");
      setModal(null);
      await load();
    } catch (e) { toast(e instanceof ApiError ? e.message : "O'chirishda xatolik", "error"); }
    finally { setSaving(false); }
  };

  return (
    <main className="ses-scrollbar flex-1 space-y-5 overflow-y-auto p-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tarif nomi yoki tavsifi…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" />
            {search && <button onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>}
          </div>
          <button onClick={() => void load()} className="rounded-xl border border-border p-2.5 text-muted-foreground hover:bg-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
          {canManage && (
            <button onClick={() => setModal({ type: "add" })} style={{ background: primaryColor }} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white"><Plus className="h-4 w-4" />Yangi tarif</button>
          )}
        </div>
        {error && <div className="mx-5 mt-4 flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/40">{["Tarif", "Tavsif", "Narxi", "Davri", "Yaratilgan", ""].map(h => <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{h}</th>)}</tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" style={{ color: primaryColor }} /></td></tr>
                : !filtered.length ? <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-3 h-7 w-7" />Tarif topilmadi</td></tr>
                  : filtered.map(plan => (
                    <tr key={plan.id} className="group border-b border-border hover:bg-secondary/30">
                      <td className="px-5 py-3.5 text-[13px] font-semibold">{plan.name}</td>
                      <td className="max-w-[320px] px-5 py-3.5 text-[12px] text-muted-foreground"><span className="line-clamp-2">{plan.description}</span></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] font-semibold">{formatSomDisplay(plan.price)}</td>
                      <td className="px-5 py-3.5"><span className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-semibold">{plan.billingCycle === "yearly" ? "Yillik" : "Oylik"}</span></td>
                      <td className="whitespace-pre-line px-5 py-3.5 text-[12px] text-muted-foreground">{plan.createdAt ? formatDate(plan.createdAt) : "—"}</td>
                      <td className="px-5 py-3.5">
                        {canManage && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                            <button onClick={() => setModal({ type: "edit", plan })} className="rounded-lg p-1.5 text-muted-foreground hover:text-violet-600"><Edit3 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => setModal({ type: "delete", plan })} className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3.5 text-xs text-muted-foreground">{filtered.length} ta tarif</div>
      </div>

      {canManage && modal?.type === "add" && <PlanModal initial={EMPTY} saving={saving} primaryColor={primaryColor} title="Yangi tarif" onSave={save} onClose={() => setModal(null)} />}
      {canManage && modal?.type === "edit" && <PlanModal initial={{ name: modal.plan.name, description: modal.plan.description, price: String(modal.plan.price), billingCycle: modal.plan.billingCycle }} saving={saving} primaryColor={primaryColor} title="Tarifni tahrirlash" onSave={save} onClose={() => setModal(null)} />}
      {canManage && modal?.type === "delete" && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/45" onClick={() => setModal(null)} /><div className="relative w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-2xl"><Trash2 className="mx-auto mb-4 h-8 w-8 text-red-500" /><h2 className="font-bold">Tarifni o&apos;chirish</h2><p className="my-3 text-[13px] text-muted-foreground">&quot;{modal.plan.name}&quot; tarifini o&apos;chirasizmi?</p><div className="flex gap-3"><button onClick={() => setModal(null)} className="flex-1 rounded-xl border border-border py-2.5 text-sm">Bekor qilish</button><button disabled={saving} onClick={() => void remove()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm text-white">{saving && <Loader2 className="h-4 w-4 animate-spin" />}O&apos;chirish</button></div></div></div>}
      <div className="fixed bottom-6 right-6 z-[60] space-y-2">{toasts.map(t => <div key={t.id} className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm shadow-xl ${t.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>{t.type === "success" ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}{t.text}</div>)}</div>
    </main>
  );
}
