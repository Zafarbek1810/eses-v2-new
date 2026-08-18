import * as React from "react";
import { useEffect, useState } from "react";
import {
  Search, RefreshCw, Eye, Trash2, X, Loader2, CheckCircle, AlertCircle,
  ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import {
  getOrdersFull,
  getAllOrders,
  deleteOrder,
  type Order,
  type OrderStatus,
} from "@/api/order";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import {
  ORDER_STATUS_LABELS,
  statusLabel,
} from "@/lib/orderStatus";
import { OrderResultsReview } from "@/Pages/OrderResultsReview";

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

const PER_PAGE = 10;

// comment
// comment
// comment
const ORDER_STATUSES = (
  Object.entries(ORDER_STATUS_LABELS) as [OrderStatus, string][]
).map(([value, label]) => ({ value, label }));

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-semibold ${statusBadgeClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

function patientName(order: Order) {
  const p = order.patient;
  if (!p) return order.name || "—";
  return `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim() || "—";
}

function orderAnalyses(order: Order) {
  const items = order.items ?? [];
  if (items.length === 0) return [] as { name: string; lab: string; status: string }[];
  return items.map(item => ({
    name: item.analysis?.name ?? item.analysis?.shortname ?? "—",
    lab: item.laboratory?.name ?? "—",
    status: String(item.status || "pending"),
  }));
}

export function OrdersPage({ primaryColor }: { primaryColor: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [labId, setLabId] = useState<number | "">("");
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);

  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
// nagap
  const loadOrders = async (opts?: {
    page?: number;
    search?: string;
    status?: string;
    lab_id?: number | "";
  }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    const st = opts?.status ?? statusFilter;
    const lab = opts?.lab_id !== undefined ? opts.lab_id : labId;

    setLoading(true);
    setError(null);
    try {
      const res = await getOrdersFull({
        page: p,
        limit: PER_PAGE,
        search: s || undefined,
        status: st || undefined,
        lab_id: lab === "" ? undefined : lab,
      });
      setOrders(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      // Fallback: getfull yo'q yoki lab path farq qilsa getall
      try {
        const all = await getAllOrders();
        let list = Array.isArray(all) ? all : [];
        if (s.trim()) {
          const q = s.trim().toLowerCase();
          list = list.filter(o => {
            const name = patientName(o).toLowerCase();
            const phone = (o.patient?.phone ?? "").toLowerCase();
            return name.includes(q) || phone.includes(q) || String(o.id).includes(q);
          });
        }
        if (st) list = list.filter(o => String(o.status) === st);
        if (lab !== "") {
          list = list.filter(o =>
            (o.items ?? []).some(i => i.laboratory?.id === lab),
          );
        }
        const start = (p - 1) * PER_PAGE;
        setOrders(list.slice(start, start + PER_PAGE));
        setTotal(list.length);
        setPage(p);
        setError(null);
      } catch (err2) {
        setError(
          err instanceof ApiError
            ? err.message
            : err2 instanceof ApiError
              ? err2.message
              : "Buyurtmalarni yuklab bo'lmadi",
        );
        setOrders([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        const labs = await getAllLaboratories();
        setLaboratories(Array.isArray(labs) ? labs : []);
      } catch {
        setLaboratories([]);
      }
    })();
  }, []);

  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, labId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteOrder(deleteTarget.id);
      pushToast(`Buyurtma #${deleteTarget.id} o'chirildi`, "success");
      setDeleteTarget(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadOrders({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (detailId != null) {
    return (
      <OrderResultsReview
        orderId={detailId}
        primaryColor={primaryColor}
        onBack={() => {
          setDetailId(null);
          void loadOrders();
        }}
        onConfirmed={(message, type = "success") => {
          setDetailId(null);
          void loadOrders();
          pushToast(message, type);
        }}
      />
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
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
              <ClipboardList className="w-4 h-4 text-teal-500 shrink-0" />
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
            <ClipboardList className="w-4 h-4" style={{ color: primaryColor }} />
          </div>
          <div className="mr-auto min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">Buyurtmalar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Barcha orderlar ro&apos;yxati va holatlari
            </p>
          </div>

          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px] max-w-sm">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder="Bemor, telefon yoki ID..."
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
            value={statusFilter}
            onChange={e => {
              setPage(1);
              setStatusFilter(e.target.value);
            }}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none"
          >
            <option value="">Barcha holatlar</option>
            {ORDER_STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select
            value={labId === "" ? "" : String(labId)}
            onChange={e => {
              setPage(1);
              setLabId(e.target.value ? Number(e.target.value) : "");
            }}
            className="bg-secondary border border-border rounded-xl px-3 py-2.5 text-[13px] text-foreground focus:outline-none max-w-[180px]"
          >
            <option value="">Barcha lablar</option>
            {laboratories.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void loadOrders()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto ses-scrollbar">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">ID</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bemor</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Analizlar</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Laboratoriya</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Analiz holati</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Buyurtma</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sana</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: primaryColor }} />
                    <p className="text-sm text-muted-foreground mt-3">Yuklanmoqda...</p>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-sm font-medium text-foreground">Buyurtmalar topilmadi</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Qidiruv yoki filterni o&apos;zgartiring
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map(order => {
                  const analyses = orderAnalyses(order);
                  return (
                  <tr
                    key={order.id}
                    onClick={() => setDetailId(order.id)}
                    className="border-b border-border hover:bg-secondary/30 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                      #{order.id}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-foreground">{patientName(order)}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {order.patient?.phone || "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {analyses.length === 0 ? (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-1 max-w-[260px]">
                          {analyses.map((a, i) => (
                            <span key={i} className="text-[13px] font-medium text-foreground truncate">
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {analyses.length === 0 ? (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {analyses.map((a, i) => (
                            <span key={i} className="text-[12px] text-muted-foreground truncate max-w-[160px]">
                              {a.lab}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {analyses.length === 0 ? (
                        <span className="text-[12px] text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {analyses.map((a, i) => (
                            <StatusBadge key={i} status={a.status} />
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={String(order.status)} />
                    </td>
                    <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-line">
                      {order.createdAt ? formatDate(order.createdAt) : "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => setDetailId(order.id)}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          title="PDF natijalar"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(order)}
                          className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-6">
            <h3 className="text-[15px] font-semibold text-foreground">Buyurtmani o&apos;chirish</h3>
            <p className="text-sm text-muted-foreground mt-2">
              #{deleteTarget.id} — <span className="font-medium text-foreground">{patientName(deleteTarget)}</span>{" "}
              buyurtmasini o&apos;chirishni tasdiqlaysizmi?
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
    </main>
  );
}
