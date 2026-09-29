import * as React from "react";
import { useEffect, useState } from "react";
import {
  Search, RefreshCw, Plus, Pencil, Trash2, X, Loader2,
  CheckCircle, AlertCircle, ShieldCheck, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import {
  getAllSanmins,
  getSanminsFull,
  addSanmin,
  updateSanmin,
  deleteSanmin,
  getSanminTotalAmountRange,
  type Sanmin,
  type SanminPayload,
  type SanminPaymentMethod,
  type SanminPaymentStatus,
} from "@/api/sanmin";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

const PER_PAGE = 10;

const PAYMENT_METHODS: { value: SanminPaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "click", label: "Click" },
  { value: "transfer", label: "Hisobdan o'tkazish" },
];

const PAYMENT_STATUSES: { value: SanminPaymentStatus; label: string }[] = [
  { value: "paid", label: "To'langan" },
  { value: "unpaid", label: "To'lanmagan" },
];

type FormState = {
  name: string;
  description: string;
  phone: string;
  workplace: string;
  payment_method: SanminPaymentMethod;
  payment_status: SanminPaymentStatus;
  price: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  phone: "+998",
  workplace: "",
  payment_method: "cash",
  payment_status: "paid",
  price: "",
};

function formatPrice(raw: string | number | undefined): string {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("uz-UZ") + " so'm";
}

function paymentMethodLabel(value: string) {
  return PAYMENT_METHODS.find(m => m.value === value)?.label || value || "—";
}

function paymentStatusLabel(value: string) {
  return PAYMENT_STATUSES.find(s => s.value === value)?.label || value || "—";
}

function paymentStatusClass(status: string) {
  if (status === "paid") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  }
  if (status === "unpaid") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  }
  return "bg-secondary text-muted-foreground";
}

function toForm(item: Sanmin): FormState {
  return {
    name: item.name ?? "",
    description: item.description ?? "",
    phone: item.phone || "+998",
    workplace: item.workplace ?? "",
    payment_method: item.payment_method || "cash",
    payment_status: item.payment_status || "paid",
    price: String(item.price ?? ""),
  };
}

function sanitizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  return digits ? `+998${digits}` : "+998";
}

export function SanMinimumPanel({ primaryColor }: { primaryColor: string }) {
  const [items, setItems] = useState<Sanmin[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Sanmin | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Sanmin | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const loadList = async (opts?: {
    page?: number;
    search?: string;
  }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;

    setLoading(true);
    setError(null);
    try {
      const needsClientFilter = Boolean(
        paymentMethodFilter || paymentStatusFilter || startDate || endDate,
      );

      if (needsClientFilter) {
        const all = await getAllSanmins().catch(async () => {
          const res = await getSanminsFull({
            page: 1,
            limit: 500,
            search: s || undefined,
          });
          return res.data;
        });
        let list = Array.isArray(all) ? all : [];

        if (s.trim()) {
          const q = s.trim().toLowerCase();
          list = list.filter(i => {
            const hay = [
              i.name,
              i.phone,
              i.workplace,
              i.description,
              String(i.id),
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return hay.includes(q);
          });
        }
        if (paymentMethodFilter) {
          list = list.filter(i => String(i.payment_method) === paymentMethodFilter);
        }
        if (paymentStatusFilter) {
          list = list.filter(i => String(i.payment_status) === paymentStatusFilter);
        }
        if (startDate || endDate) {
          list = list.filter(i => {
            if (!i.createdAt) return false;
            const d = i.createdAt.slice(0, 10);
            if (startDate && d < startDate) return false;
            if (endDate && d > endDate) return false;
            return true;
          });
        }

        const totalCountLocal = list.length;
        const start = (p - 1) * PER_PAGE;
        setItems(list.slice(start, start + PER_PAGE));
        setTotal(totalCountLocal);
      } else {
        const res = await getSanminsFull({
          page: p,
          limit: PER_PAGE,
          search: s || undefined,
        });
        setItems(res.data);
        setTotal(res.total);
      }

      try {
        const range = await getSanminTotalAmountRange({
          search: s || undefined,
          payment_method: paymentMethodFilter || undefined,
          payment_status: paymentStatusFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        });
        setTotalAmount(range.totalAmount);
        setTotalCount(range.count);
      } catch {
        setTotalAmount(0);
        setTotalCount(0);
      }
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof ApiError ? err.message : "San minimumlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, paymentMethodFilter, paymentStatusFilter, startDate, endDate]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setPaymentMethodFilter("");
    setPaymentStatusFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (item: Sanmin) => {
    setEditing(item);
    setForm(toForm(item));
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();
    const price = form.price.trim().replace(/\s/g, "");

    if (!name) {
      setFormError("Ism-familiyani kiriting");
      return;
    }
    if (!phone || phone === "+998" || phone.length < 13) {
      setFormError("Telefon raqamini to'liq kiriting");
      return;
    }
    if (!price || !Number.isFinite(Number(price)) || Number(price) < 0) {
      setFormError("Narxni to'g'ri kiriting");
      return;
    }

    const payload: SanminPayload = {
      name,
      description: form.description.trim(),
      phone,
      workplace: form.workplace.trim(),
      payment_method: form.payment_method,
      payment_status: form.payment_status,
      price,
    };

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await updateSanmin(editing.id, payload);
        pushToast("San minimum yangilandi");
      } else {
        await addSanmin(payload);
        pushToast("San minimum qo'shildi");
      }
      setFormOpen(false);
      setEditing(null);
      void loadList({ page: editing ? page : 1 });
      if (!editing) setPage(1);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSanmin(deleteTarget.id);
      pushToast("San minimum o'chirildi");
      setDeleteTarget(null);
      void loadList();
    } catch (err) {
      pushToast(
        err instanceof ApiError ? err.message : "O'chirib bo'lmadi",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="fixed top-20 right-6 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-card animate-fade-in min-w-[260px]"
            style={{
              borderColor:
                t.type === "success" ? "#86efac" : t.type === "error" ? "#fca5a5" : "#93c5fd",
            }}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : t.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${primaryColor}18` }}
          >
            <ShieldCheck className="w-4 h-4" style={{ color: primaryColor }} />
          </div>
          <div className="mr-auto min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground">San minimum</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              SES vakillari va to&apos;lov yozuvlari
            </p>
          </div>

          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" />
            Qo&apos;shish
          </button>
        </div>

        <div className="px-5 py-4 border-b border-border space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px] max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Ism, telefon yoki ish joyi..."
                className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearch("");
                    setPage(1);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <select
              value={paymentMethodFilter}
              onChange={e => {
                setPage(1);
                setPaymentMethodFilter(e.target.value);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
            >
              <option value="">Barcha to&apos;lovlar</option>
              {PAYMENT_METHODS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            <select
              value={paymentStatusFilter}
              onChange={e => {
                setPage(1);
                setPaymentStatusFilter(e.target.value);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
            >
              <option value="">Barcha holatlar</option>
              {PAYMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>

            <input
              type="date"
              value={startDate}
              onChange={e => {
                setPage(1);
                setStartDate(e.target.value);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
              title="Boshlanish sanasi"
            />
            <input
              type="date"
              value={endDate}
              onChange={e => {
                setPage(1);
                setEndDate(e.target.value);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
              title="Tugash sanasi"
            />

            <button
              type="button"
              onClick={applySearch}
              className="px-3.5 py-2.5 rounded-xl text-[13px] font-semibold text-white"
              style={{ background: primaryColor }}
            >
              Qidirish
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tozalash
            </button>

            <button
              type="button"
              onClick={() => void loadList()}
              className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[12px]">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground">
              Jami summa:{" "}
              <span className="font-semibold text-foreground">{formatPrice(totalAmount)}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground">
              Yozuvlar:{" "}
              <span className="font-semibold text-foreground">{totalCount || total}</span>
            </span>
          </div>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto ses-scrollbar">
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">F.I.Sh</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Telefon</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ish joyi</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">To&apos;lov</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Holat</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Narx</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sana</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: primaryColor }} />
                    <p className="text-sm text-muted-foreground mt-3">Yuklanmoqda...</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <ShieldCheck className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Yozuvlar topilmadi</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Filterlarni o&apos;zgartiring yoki yangi yozuv qo&apos;shing
                    </p>
                  </td>
                </tr>
              ) : (
                items.map(item => (
                  <tr
                    key={item.id}
                    className="border-b border-border hover:bg-secondary/30 transition-colors group"
                  >
                    <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                      #{item.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-foreground">{item.name || "—"}</p>
                      {item.description ? (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.description}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground whitespace-nowrap">
                      {item.phone || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-muted-foreground max-w-[180px] truncate">
                      {item.workplace || "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">
                      {paymentMethodLabel(String(item.payment_method || ""))}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${paymentStatusClass(String(item.payment_status || ""))}`}
                      >
                        {paymentStatusLabel(String(item.payment_status || ""))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap">
                      {formatPrice(item.price)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-line">
                      {item.createdAt ? formatDate(item.createdAt) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border flex-wrap">
          <p className="text-[12px] text-muted-foreground">
            Jami: <span className="font-semibold text-foreground">{total}</span> ta · Sahifa {page}/{totalPages}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(1)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage(totalPages)}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary disabled:opacity-40"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={closeForm} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto ses-scrollbar p-6">
            <div className="flex items-start justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {editing ? "San minimumni tahrirlash" : "Yangi san minimum"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Barcha majburiy maydonlarni to&apos;ldiring
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">F.I.Sh *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="F.I.Sh"
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-offset-0"
                  style={{ ["--tw-ring-color" as string]: primaryColor }}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Telefon *</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: sanitizePhone(e.target.value) }))}
                  placeholder="+998901234567"
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Ish joyi</span>
                <input
                  type="text"
                  value={form.workplace}
                  onChange={e => setForm(f => ({ ...f, workplace: e.target.value }))}
                  placeholder="Ish joyi"
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-muted-foreground">To&apos;lov usuli</span>
                  <select
                    value={form.payment_method}
                    onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-muted-foreground">To&apos;lov holati</span>
                  <select
                    value={form.payment_status}
                    onChange={e => setForm(f => ({ ...f, payment_status: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none"
                  >
                    {PAYMENT_STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-[12px] font-medium text-muted-foreground">Narx *</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: e.target.value.replace(/[^\d]/g, "") }))}
                  placeholder="150000"
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none"
                />
              </label>
            </div>

            {formError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[13px] text-red-700 dark:text-red-300">{formError}</p>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-70"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ background: primaryColor }}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editing ? "Saqlash" : "Qo'shish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold text-foreground">O&apos;chirish</h3>
            <p className="text-sm text-muted-foreground mt-2">
              #{deleteTarget.id} —{" "}
              <span className="font-medium text-foreground">{deleteTarget.name}</span>{" "}
              yozuvini o&apos;chirishni tasdiqlaysizmi?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
