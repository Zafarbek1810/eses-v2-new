import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  FileText, ClipboardCheck, Building2,
  Users, RefreshCw, CheckCircle,
  ArrowUpRight, ArrowDownRight, Info, AlertCircle, Calendar,
  Wallet, ClipboardList, Banknote, Clock3, Loader2, ChevronDown,
  CreditCard, Coins, MousePointerClick, FlaskConical, ShieldCheck,
} from "lucide-react";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  getAllOrders,
  getOrdersFull,
  getOrderTotalAmountRange,
  resolveOrderType,
  type Order,
  type OrderTotalAmountRange,
} from "@/api/order";
import {
  getAllSanmins,
  getSanminsFull,
  getSanminTotalAmountRange,
  type Sanmin,
  type SanminTotalAmountRange,
} from "@/api/sanmin";
import {
  getAllDeals,
  getDealsFull,
  getDealTotalAmountRange,
  type Deal,
  type DealTotalAmountRange,
} from "@/api/deal";
import { getAllLaboratories } from "@/api/laboratory";
import { getStoredUser } from "@/api/session";
import { normalizeRoleName } from "@/lib/roles";
import { resolveUserLabScope } from "@/lib/labScope";
import { statusLabel } from "@/lib/orderStatus";
import { Calendar as DatePickerCalendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

type LabChartRow = {
  lab: string;
  count: number;
  totalFinalAmount: number;
};

type TrendRow = {
  month: string;
  orders: number;
  paid: number;
};

type ActivityRow = {
  id: string;
  type: string;
  subject: string;
  owner: string;
  status: string;
  payment: string;
  date: string;
};

type SanminActivityRow = {
  id: string;
  name: string;
  workplace: string;
  phone: string;
  paymentMethod: string;
  paymentStatus: string;
  price: string;
  date: string;
};

const emptySanminRange = (): SanminTotalAmountRange => ({ totalAmount: 0, count: 0 });
const emptyDealRange = (): DealTotalAmountRange => ({ totalAmount: 0, count: 0 });

type DealActivityRow = {
  id: string;
  name: string;
  number: string;
  owner: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: string;
  date: string;
};

function mapDealToActivity(item: Deal): DealActivityRow {
  return {
    id: `#${item.id}`,
    name: String(item.name ?? "").trim() || "—",
    number: String(item.number ?? "").trim() || "—",
    owner: String(item.owner_name ?? "").trim() || "—",
    paymentMethod: sanminPaymentMethodLabel(String(item.payment_method ?? "")),
    paymentStatus: String(item.payment_status ?? "pending"),
    amount: formatSanminPrice(item.amount),
    date: formatShortDate(item.createdAt ?? item.updatedAt),
  };
}

async function fetchRecentDeals(limit = 8): Promise<{ rows: DealActivityRow[]; total: number }> {
  const sortNewest = (list: Deal[]) =>
    [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
      return tb - ta;
    });

  try {
    const res = await getDealsFull({ page: 1, limit });
    const sorted = sortNewest(res.data).slice(0, limit);
    return { rows: sorted.map(mapDealToActivity), total: res.total };
  } catch {
    const all = await getAllDeals().catch(() => [] as Deal[]);
    const list = sortNewest(Array.isArray(all) ? all : []);
    return {
      rows: list.slice(0, limit).map(mapDealToActivity),
      total: list.length,
    };
  }
}

const SANMIN_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Naqd",
  card: "Karta",
  click: "Click",
  transfer: "Hisobdan o'tkazish",
};

function sanminPaymentMethodLabel(value: string) {
  return SANMIN_PAYMENT_METHOD_LABELS[value] ?? value ?? "—";
}

function formatSanminPrice(raw: string | number | undefined) {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/\s/g, ""));
  if (!Number.isFinite(n)) return "—";
  return formatSom(n);
}

function mapSanminToActivity(item: Sanmin): SanminActivityRow {
  return {
    id: `#${item.id}`,
    name: String(item.name ?? "").trim() || "—",
    workplace: String(item.workplace ?? "").trim() || "—",
    phone: String(item.phone ?? "").trim() || "—",
    paymentMethod: sanminPaymentMethodLabel(String(item.payment_method ?? "")),
    paymentStatus: String(item.payment_status ?? "pending"),
    price: formatSanminPrice(item.price),
    date: formatShortDate(item.createdAt ?? item.updatedAt),
  };
}

async function fetchRecentSanmins(limit = 8): Promise<{ rows: SanminActivityRow[]; total: number }> {
  const sortNewest = (list: Sanmin[]) =>
    [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
      return tb - ta;
    });

  try {
    const res = await getSanminsFull({ page: 1, limit });
    const sorted = sortNewest(res.data).slice(0, limit);
    return { rows: sorted.map(mapSanminToActivity), total: res.total };
  } catch {
    const all = await getAllSanmins().catch(() => [] as Sanmin[]);
    const list = sortNewest(Array.isArray(all) ? all : []);
    return {
      rows: list.slice(0, limit).map(mapSanminToActivity),
      total: list.length,
    };
  }
}

type InsightItem = {
  id: string;
  title: string;
  desc: string;
  type: "info" | "warning" | "success";
  date: string;
};

const MONTH_LABELS_UZ = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyun",
  "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek",
] as const;

const PIE_COLORS = [
  "#0D9488", "#059669", "#2563EB", "#D97706",
  "#7C3AED", "#EA580C", "#0E7490", "#DC2626",
  "#0891B2", "#4F46E5",
];

const ORDER_TYPE_LABELS: Record<string, string> = {
  patient: "Bemor",
  sample: "Tashkilot",
  course: "Kurs",
};

function formatSom(value: number) {
  return `${Math.round(value).toLocaleString("uz-UZ")} so'm`;
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplayDate(s: string) {
  return format(parseIsoDate(s), "dd.MM.yyyy");
}

/** Joriy oyning 1-kunidan bugungi kungacha. */
function currentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { startDate: toIsoDate(start), endDate: toIsoDate(now) };
}

const emptyRange = (): OrderTotalAmountRange => ({ totalFinalAmount: 0, count: 0 });

function sumRanges(parts: OrderTotalAmountRange[]): OrderTotalAmountRange {
  return parts.reduce(
    (acc, p) => ({
      totalFinalAmount: acc.totalFinalAmount + p.totalFinalAmount,
      count: acc.count + p.count,
    }),
    emptyRange(),
  );
}

async function fetchRangeForLabs(
  labIds: number[] | null,
  params: Parameters<typeof getOrderTotalAmountRange>[0],
): Promise<OrderTotalAmountRange> {
  if (labIds && labIds.length === 0) return emptyRange();
  if (!labIds || labIds.length === 0) {
    return getOrderTotalAmountRange(params);
  }
  if (labIds.length === 1) {
    return getOrderTotalAmountRange({ ...params, lab_id: labIds[0] });
  }
  const parts = await Promise.all(
    labIds.map(id => getOrderTotalAmountRange({ ...params, lab_id: id })),
  );
  return sumRanges(parts);
}

function monthRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const today = new Date();
  const endClamped =
    end.getFullYear() === today.getFullYear() &&
    end.getMonth() === today.getMonth() &&
    end > today
      ? today
      : end;
  return { startDate: toIsoDate(start), endDate: toIsoDate(endClamped) };
}

function yearMonths(year = new Date().getFullYear()): { year: number; monthIndex: number; label: string }[] {
  return MONTH_LABELS_UZ.map((label, monthIndex) => ({
    year,
    monthIndex,
    label,
  }));
}

function orderSubject(order: Order) {
  const p = order.patient;
  if (p) {
    const name = `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim();
    if (name) return name;
  }
  const org = String(order.name ?? "").trim();
  return org || "—";
}

function orderOwnerLabel(order: Order) {
  const o = order.owner;
  if (!o) return "—";
  const name = `${o.surname ?? ""} ${o.username ?? ""}`.trim();
  return name || "—";
}

function formatShortDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, "dd.MM.yyyy");
  } catch {
    return "—";
  }
}

function orderTypeLabel(order: Order) {
  const t = resolveOrderType(order);
  return ORDER_TYPE_LABELS[t] ?? t;
}

function mapOrderToActivity(order: Order): ActivityRow {
  return {
    id: `#${order.id}`,
    type: orderTypeLabel(order),
    subject: orderSubject(order),
    owner: orderOwnerLabel(order),
    status: String(order.status ?? "pending"),
    payment: String(order.payment_status ?? "pending"),
    date: formatShortDate(order.createdAt ?? order.updatedAt),
  };
}

async function fetchRecentOrders(labIds: number[] | null, limit = 8): Promise<{ rows: ActivityRow[]; total: number }> {
  if (labIds && labIds.length === 0) return { rows: [], total: 0 };

  const sortNewest = (list: Order[]) =>
    [...list].sort((a, b) => {
      const ta = new Date(a.createdAt ?? a.updatedAt ?? 0).getTime();
      const tb = new Date(b.createdAt ?? b.updatedAt ?? 0).getTime();
      return tb - ta;
    });

  try {
    if (!labIds || labIds.length <= 1) {
      const res = await getOrdersFull({
        page: 1,
        limit,
        lab_id: labIds?.[0],
      });
      const sorted = sortNewest(res.data).slice(0, limit);
      return { rows: sorted.map(mapOrderToActivity), total: res.total };
    }

    const parts = await Promise.all(
      labIds.map(id => getOrdersFull({ page: 1, limit, lab_id: id }).catch(() => ({ data: [] as Order[], total: 0, page: 1, limit }))),
    );
    const merged = sortNewest(parts.flatMap(p => p.data)).slice(0, limit);
    const total = parts.reduce((acc, p) => acc + (p.total || 0), 0);
    return { rows: merged.map(mapOrderToActivity), total };
  } catch {
    const all = await getAllOrders().catch(() => [] as Order[]);
    let list = sortNewest(all);
    if (labIds?.length) {
      const set = new Set(labIds);
      list = list.filter(o =>
        (o.items ?? []).some(it => it.laboratory?.id != null && set.has(it.laboratory.id)),
      );
    }
    return {
      rows: list.slice(0, limit).map(mapOrderToActivity),
      total: list.length,
    };
  }
}

const DATE_PRESETS = [
  {
    id: "today",
    label: "Bugun",
    range: () => {
      const d = toIsoDate(new Date());
      return { startDate: d, endDate: d };
    },
  },
  {
    id: "7d",
    label: "7 kun",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 6);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
  {
    id: "30d",
    label: "30 kun",
    range: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 29);
      return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
    },
  },
  {
    id: "month",
    label: "Bu oy",
    range: currentMonthRange,
  },
] as const;

const PAYMENT_METHODS = [
  { id: "cash", label: "Naqd", method: "cash", icon: Coins, iconBg: "#ECFDF5", iconColor: "#059669" },
  { id: "card", label: "Karta", method: "card", icon: CreditCard, iconBg: "#EFF6FF", iconColor: "#2563EB" },
  { id: "click", label: "Click", method: "click", icon: MousePointerClick, iconBg: "#FFF7ED", iconColor: "#EA580C" },
  { id: "transfer", label: "Hisobdan o'tkazish", method: "transfer", icon: Banknote, iconBg: "#F5F3FF", iconColor: "#7C3AED" },
] as const;

const StatusBadge = ({ status }: { status: string }) => {
  const key = status.toLowerCase();
  const MAP: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    completed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    paid: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    unpaid: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    partially_completed: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
    in_progress: "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
    canceled: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
    refunded: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${MAP[key] ?? "bg-gray-50 text-gray-700"}`}>
      {statusLabel(status)}
    </span>
  );
};

type StatCardProps = {
  label: string; value: string; description: string;
  icon: React.ElementType; trend?: number;
  iconBg: string; iconColor: string; primaryColor: string;
  loading?: boolean;
  compact?: boolean;
};

const StatCard = ({ label, value, description, icon: Icon, trend, iconBg, iconColor, loading, compact }: StatCardProps) => {
  if (compact) {
    return (
      <div className="bg-card rounded-lg px-3.5 py-2.5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] flex items-center gap-3 min-h-[68px]">
        <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: iconBg }}>
          <Icon className="w-4 h-4" style={{ color: iconColor }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold text-muted-foreground leading-none mb-1">{label}</div>
          <div className="text-[18px] font-extrabold text-foreground leading-none tracking-tight truncate">
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              value
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 truncate">{description}</div>
        </div>
      </div>
    );
  }

  return (
  <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] hover:shadow-[0_8px_24px_rgba(12,31,28,0.07)] hover:-translate-y-0.5 transition-all duration-200 group cursor-default">
    <div className="flex items-start justify-between mb-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: iconBg }}>
        <Icon className="w-[18px] h-[18px]" style={{ color: iconColor }} />
      </div>
      {trend != null && (
        <div className={`flex items-center gap-0.5 text-[11px] font-bold ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {trend >= 0
            ? <ArrowUpRight className="w-3.5 h-3.5" />
            : <ArrowDownRight className="w-3.5 h-3.5" />
          }
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <div className="text-[28px] font-extrabold text-foreground leading-none mb-1.5 tracking-tight">
      {loading ? (
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      ) : (
        value
      )}
    </div>
    <div className="text-[13px] font-semibold text-foreground mb-0.5">{label}</div>
    <div className="text-[11px] text-muted-foreground">{description}</div>
  </div>
  );
};

export const DashboardPage = ({ primaryColor }: { primaryColor: string }) => {
  const role = normalizeRoleName(getStoredUser()?.role?.name);
  const isKassirSangig = role === "kassir_sangig";
  const isDirector = role === "director";
  const isLabStatsRole =
    role === "lab_director" || role === "lab_asistant" || role === "director" || isKassirSangig;

  const initialRange = useMemo(() => {
    const d = toIsoDate(new Date());
    return { startDate: d, endDate: d };
  }, []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scopedLabIds, setScopedLabIds] = useState<number[] | null>(null);
  const [labScopeReady, setLabScopeReady] = useState(!isKassirSangig);

  const [labStatsLoading, setLabStatsLoading] = useState(isLabStatsRole);
  const [labAll, setLabAll] = useState<OrderTotalAmountRange>(emptyRange);
  const [labPaid, setLabPaid] = useState<OrderTotalAmountRange>(emptyRange);
  const [labPending, setLabPending] = useState<OrderTotalAmountRange>(emptyRange);
  const [paymentByMethod, setPaymentByMethod] = useState<Record<string, OrderTotalAmountRange>>({
    cash: emptyRange(),
    card: emptyRange(),
    click: emptyRange(),
    transfer: emptyRange(),
  });

  const [labChartLoading, setLabChartLoading] = useState(true);
  const [labChartData, setLabChartData] = useState<LabChartRow[]>([]);

  const [trendLoading, setTrendLoading] = useState(!isKassirSangig);
  const [trendData, setTrendData] = useState<TrendRow[]>([]);

  const [activitiesLoading, setActivitiesLoading] = useState(!isKassirSangig);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [activitiesTotal, setActivitiesTotal] = useState(0);

  const [sanminLoading, setSanminLoading] = useState(true);
  const [sanminRows, setSanminRows] = useState<SanminActivityRow[]>([]);
  const [sanminTotal, setSanminTotal] = useState(0);
  const [sanminRangeStats, setSanminRangeStats] = useState<SanminTotalAmountRange>(emptySanminRange);
  const [sanminPaidStats, setSanminPaidStats] = useState<SanminTotalAmountRange>(emptySanminRange);
  const [sanminStatsLoading, setSanminStatsLoading] = useState(isLabStatsRole);

  const [dealLoading, setDealLoading] = useState(isDirector);
  const [dealRows, setDealRows] = useState<DealActivityRow[]>([]);
  const [dealTotal, setDealTotal] = useState(0);
  const [dealRangeStats, setDealRangeStats] = useState<DealTotalAmountRange>(emptyDealRange);
  const [dealPaidStats, setDealPaidStats] = useState<DealTotalAmountRange>(emptyDealRange);
  const [dealUnpaidStats, setDealUnpaidStats] = useState<DealTotalAmountRange>(emptyDealRange);
  const [dealStatsLoading, setDealStatsLoading] = useState(isDirector);

  const [labCompleted, setLabCompleted] = useState<OrderTotalAmountRange>(emptyRange());
  const [labPartial, setLabPartial] = useState<OrderTotalAmountRange>(emptyRange());
  const [extraStatsLoading, setExtraStatsLoading] = useState(isLabStatsRole && !isKassirSangig);

  const selectedRange: DateRange = {
    from: parseIsoDate(startDate),
    to: parseIsoDate(endDate),
  };

  const rangeLabel = `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`;

  const applyRange = (next: { startDate: string; endDate: string }) => {
    const start = next.startDate <= next.endDate ? next.startDate : next.endDate;
    const end = next.startDate <= next.endDate ? next.endDate : next.startDate;
    setStartDate(start);
    setEndDate(end);
  };

  const onCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) return;
    const from = toIsoDate(range.from);
    const to = range.to ? toIsoDate(range.to) : from;
    applyRange({ startDate: from, endDate: to });
    if (range.from && range.to) setPickerOpen(false);
  };

  useEffect(() => {
    if (!isKassirSangig) {
      setScopedLabIds(null);
      setLabScopeReady(true);
      return;
    }

    let cancelled = false;
    setLabScopeReady(false);

    void (async () => {
      const userId = getStoredUser()?.id;
      if (!userId) {
        if (!cancelled) {
          setScopedLabIds([]);
          setLabScopeReady(true);
        }
        return;
      }
      try {
        const labs = await getAllLaboratories();
        if (cancelled) return;
        const scope = resolveUserLabScope(Array.isArray(labs) ? labs : [], userId);
        setScopedLabIds([...scope.labIds]);
      } catch {
        if (!cancelled) setScopedLabIds([]);
      } finally {
        if (!cancelled) setLabScopeReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isKassirSangig]);

  useEffect(() => {
    if (!isLabStatsRole || !labScopeReady) return;

    let cancelled = false;
    const labIds = isKassirSangig ? (scopedLabIds ?? []) : null;

    void (async () => {
      setLabStatsLoading(true);
      try {
        const baseParams = { startDate, endDate };
        const [all, paid, pendingPay, cash, card, click, transfer] = await Promise.all([
          fetchRangeForLabs(labIds, baseParams),
          fetchRangeForLabs(labIds, { ...baseParams, payment_status: "paid" }),
          fetchRangeForLabs(labIds, { ...baseParams, payment_status: "pending" }),
          fetchRangeForLabs(labIds, { ...baseParams, payment_method: "cash" }),
          fetchRangeForLabs(labIds, { ...baseParams, payment_method: "card" }),
          fetchRangeForLabs(labIds, { ...baseParams, payment_method: "click" }),
          fetchRangeForLabs(labIds, { ...baseParams, payment_method: "transfer" }),
        ]);
        if (cancelled) return;
        setLabAll(all);
        setLabPaid(paid);
        setLabPending(pendingPay);
        setPaymentByMethod({ cash, card, click, transfer });
      } catch {
        if (cancelled) return;
        setLabAll(emptyRange());
        setLabPaid(emptyRange());
        setLabPending(emptyRange());
        setPaymentByMethod({
          cash: emptyRange(),
          card: emptyRange(),
          click: emptyRange(),
          transfer: emptyRange(),
        });
      } finally {
        if (!cancelled) setLabStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLabStatsRole, isKassirSangig, labScopeReady, scopedLabIds, startDate, endDate]);

  useEffect(() => {
    if (isKassirSangig && !labScopeReady) return;

    let cancelled = false;

    void (async () => {
      setLabChartLoading(true);
      try {
        const labs = await getAllLaboratories();
        if (cancelled) return;

        const allLabs = Array.isArray(labs) ? labs : [];
        const scoped = isKassirSangig ? new Set(scopedLabIds ?? []) : null;
        const list = scoped
          ? allLabs.filter(lab => scoped.has(lab.id))
          : allLabs;
        const rows: LabChartRow[] = [];

        const BATCH = 6;
        for (let i = 0; i < list.length; i += BATCH) {
          const chunk = list.slice(i, i + BATCH);
          const part = await Promise.all(
            chunk.map(async lab => {
              try {
                const stats = await getOrderTotalAmountRange({
                  lab_id: lab.id,
                  startDate,
                  endDate,
                });
                return {
                  lab: lab.name?.trim() || `Lab #${lab.id}`,
                  count: stats.count,
                  totalFinalAmount: stats.totalFinalAmount,
                } satisfies LabChartRow;
              } catch {
                return {
                  lab: lab.name?.trim() || `Lab #${lab.id}`,
                  count: 0,
                  totalFinalAmount: 0,
                } satisfies LabChartRow;
              }
            }),
          );
          if (cancelled) return;
          rows.push(...part);
        }

        if (cancelled) return;
        rows.sort((a, b) => b.count - a.count || b.totalFinalAmount - a.totalFinalAmount);
        setLabChartData(rows.filter(r => r.count > 0 || r.totalFinalAmount > 0).length > 0
          ? rows.filter(r => r.count > 0 || r.totalFinalAmount > 0)
          : rows);
      } catch {
        if (!cancelled) setLabChartData([]);
      } finally {
        if (!cancelled) setLabChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isKassirSangig, labScopeReady, scopedLabIds, startDate, endDate]);

  useEffect(() => {
    if (isKassirSangig) return;

    let cancelled = false;
    const labIds = null as number[] | null;

    void (async () => {
      setTrendLoading(true);
      try {
        const year = new Date().getFullYear();
        const months = yearMonths(year);
        const rows: TrendRow[] = [];
        for (const m of months) {
          const range = monthRange(m.year, m.monthIndex);
          const [all, paid] = await Promise.all([
            fetchRangeForLabs(labIds, range),
            fetchRangeForLabs(labIds, { ...range, payment_status: "paid" }),
          ]);
          if (cancelled) return;
          rows.push({
            month: m.label,
            orders: all.count,
            paid: paid.count,
          });
        }
        if (!cancelled) setTrendData(rows);
      } catch {
        if (!cancelled) setTrendData([]);
      } finally {
        if (!cancelled) setTrendLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isKassirSangig]);

  useEffect(() => {
    if (isKassirSangig) return;
    if (!labScopeReady) return;

    let cancelled = false;
    const labIds = isKassirSangig ? (scopedLabIds ?? []) : null;

    void (async () => {
      setActivitiesLoading(true);
      try {
        const result = await fetchRecentOrders(labIds, 8);
        if (!cancelled) {
          setActivities(result.rows);
          setActivitiesTotal(result.total);
        }
      } catch {
        if (!cancelled) {
          setActivities([]);
          setActivitiesTotal(0);
        }
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isKassirSangig, labScopeReady, scopedLabIds]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setSanminLoading(true);
      try {
        const result = await fetchRecentSanmins(8);
        if (!cancelled) {
          setSanminRows(result.rows);
          setSanminTotal(result.total);
        }
      } catch {
        if (!cancelled) {
          setSanminRows([]);
          setSanminTotal(0);
        }
      } finally {
        if (!cancelled) setSanminLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLabStatsRole) {
      setSanminStatsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setSanminStatsLoading(true);
      try {
        const baseParams = { startDate, endDate };
        const [all, paid] = await Promise.all([
          getSanminTotalAmountRange(baseParams),
          getSanminTotalAmountRange({ ...baseParams, payment_status: "paid" }),
        ]);
        if (cancelled) return;
        setSanminRangeStats(all);
        setSanminPaidStats(paid);
      } catch {
        if (cancelled) return;
        setSanminRangeStats(emptySanminRange());
        setSanminPaidStats(emptySanminRange());
      } finally {
        if (!cancelled) setSanminStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLabStatsRole, startDate, endDate]);

  useEffect(() => {
    if (!isDirector) return;

    let cancelled = false;

    void (async () => {
      setDealLoading(true);
      try {
        const result = await fetchRecentDeals(8);
        if (!cancelled) {
          setDealRows(result.rows);
          setDealTotal(result.total);
        }
      } catch {
        if (!cancelled) {
          setDealRows([]);
          setDealTotal(0);
        }
      } finally {
        if (!cancelled) setDealLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDirector]);

  useEffect(() => {
    if (!isDirector) {
      setDealStatsLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      setDealStatsLoading(true);
      try {
        const baseParams = { startDate, endDate };
        const [all, paid, unpaid] = await Promise.all([
          getDealTotalAmountRange(baseParams),
          getDealTotalAmountRange({ ...baseParams, payment_status: "paid" }),
          getDealTotalAmountRange({ ...baseParams, payment_status: "unpaid" }),
        ]);
        if (cancelled) return;
        setDealRangeStats(all);
        setDealPaidStats(paid);
        setDealUnpaidStats(unpaid);
      } catch {
        if (cancelled) return;
        setDealRangeStats(emptyDealRange());
        setDealPaidStats(emptyDealRange());
        setDealUnpaidStats(emptyDealRange());
      } finally {
        if (!cancelled) setDealStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isDirector, startDate, endDate]);

  useEffect(() => {
    if (!isLabStatsRole || isKassirSangig || !labScopeReady) return;

    let cancelled = false;

    void (async () => {
      setExtraStatsLoading(true);
      try {
        const baseParams = { startDate, endDate };
        const [completed, partial] = await Promise.all([
          fetchRangeForLabs(null, { ...baseParams, status: "completed" }),
          fetchRangeForLabs(null, { ...baseParams, status: "partially_completed" }),
        ]);
        if (cancelled) return;
        setLabCompleted(completed);
        setLabPartial(partial);
      } catch {
        if (cancelled) return;
        setLabCompleted(emptyRange());
        setLabPartial(emptyRange());
      } finally {
        if (!cancelled) setExtraStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLabStatsRole, isKassirSangig, labScopeReady, startDate, endDate]);

  const defaultStats = [
    {
      label: "Total Applications", value: "1,842", description: "↑ 12.4% vs last month",
      icon: FileText, trend: 12.4,
      iconBg: `${primaryColor}14`, iconColor: primaryColor,
    },
    {
      label: "Active Inspections", value: "234", description: "Currently in progress",
      icon: ClipboardCheck, trend: -3.2,
      iconBg: "#ECFDF5", iconColor: "#059669",
    },
    {
      label: "Organizations", value: "5,420", description: "Registered entities",
      icon: Building2, trend: 8.7,
      iconBg: "#ECFEFF", iconColor: "#0E7490",
    },
    {
      label: "Total Employees", value: "1,248", description: "Active platform users",
      icon: Users, trend: 2.1,
      iconBg: "#FFFBEB", iconColor: "#D97706",
    },
  ];

  const labStats = [
    {
      label: "Jami summa",
      value: formatSom(labAll.totalFinalAmount),
      description: `${rangeLabel} · ${labAll.count} ta buyurtma`,
      icon: Wallet,
      iconBg: `${primaryColor}14`,
      iconColor: primaryColor,
      loading: labStatsLoading,
    },
    {
      label: "Buyurtmalar",
      value: labAll.count.toLocaleString("uz-UZ"),
      description: "Tanlangan oraliq bo'yicha",
      icon: ClipboardList,
      iconBg: "#ECFDF5",
      iconColor: "#059669",
      loading: labStatsLoading,
    },
    {
      label: "To'langan",
      value: formatSom(labPaid.totalFinalAmount),
      description: `${labPaid.count} ta to'langan buyurtma`,
      icon: Banknote,
      iconBg: "#ECFEFF",
      iconColor: "#0E7490",
      loading: labStatsLoading,
    },
    {
      label: "Kutilmoqda",
      value: formatSom(labPending.totalFinalAmount),
      description: `${labPending.count} ta to'lov kutilmoqda`,
      icon: Clock3,
      iconBg: "#FFFBEB",
      iconColor: "#D97706",
      loading: labStatsLoading,
    },
  ];

  const paymentMethodStats = PAYMENT_METHODS.map(item => {
    const stats = paymentByMethod[item.method];

    return {
      label: item.label,
      value: formatSom(stats.totalFinalAmount),
      description: `${stats.count.toLocaleString("uz-UZ")} ta buyurtma`,
      icon: item.icon,
      iconBg: item.iconBg,
      iconColor: item.iconColor,
      loading: labStatsLoading,
      compact: true,
    };
  });

  const stats = isLabStatsRole ? labStats : defaultStats;

  const topLab = labChartData[0] ?? null;
  const labsWithOrders = labChartData.filter(r => r.count > 0).length;
  const pieTotal = labChartData.reduce((acc, r) => acc + r.count, 0);

  const quickActions = [
    {
      icon: ClipboardList,
      label: "Buyurtmalar",
      value: labStatsLoading ? "…" : labAll.count.toLocaleString("uz-UZ"),
      hint: rangeLabel,
      color: primaryColor,
    },
    {
      icon: Banknote,
      label: "To'langan",
      value: labStatsLoading ? "…" : labPaid.count.toLocaleString("uz-UZ"),
      hint: formatSom(labPaid.totalFinalAmount),
      color: "#059669",
    },
    {
      icon: Clock3,
      label: "To'lov kutilmoqda",
      value: labStatsLoading ? "…" : labPending.count.toLocaleString("uz-UZ"),
      hint: formatSom(labPending.totalFinalAmount),
      color: "#D97706",
    },
    {
      icon: CheckCircle,
      label: "Yakunlangan",
      value: extraStatsLoading ? "…" : labCompleted.count.toLocaleString("uz-UZ"),
      hint: formatSom(labCompleted.totalFinalAmount),
      color: "#0E7490",
    },
    {
      icon: FlaskConical,
      label: "Laboratoriyalar",
      value: labChartLoading ? "…" : String(labChartData.length),
      hint: `${labsWithOrders} tasida buyurtma bor`,
      color: "#7C3AED",
    },
    {
      icon: ShieldCheck,
      label: "San minimum",
      value: sanminStatsLoading ? "…" : sanminRangeStats.count.toLocaleString("uz-UZ"),
      hint: formatSom(sanminRangeStats.totalAmount),
      color: "#0F766E",
    },
    ...(isDirector
      ? [{
          icon: FileText,
          label: "Shartnomalar",
          value: dealStatsLoading ? "…" : dealRangeStats.count.toLocaleString("uz-UZ"),
          hint: formatSom(dealRangeStats.totalAmount),
          color: "#2563EB",
        }]
      : []),
  ];

  const announcements = ((): InsightItem[] => {
    const today = format(new Date(), "dd.MM");
    const items: InsightItem[] = [];

    if (labPending.count > 0) {
      items.push({
        id: "pending-pay",
        title: "To'lov kutilmoqda",
        desc: `${labPending.count} ta buyurtma · ${formatSom(labPending.totalFinalAmount)}`,
        type: "warning",
        date: today,
      });
    }

    if (labPartial.count > 0) {
      items.push({
        id: "partial",
        title: "Jarayondagi buyurtmalar",
        desc: `${labPartial.count} ta buyurtma qisman yakunlangan`,
        type: "info",
        date: today,
      });
    }

    if (labCompleted.count > 0) {
      items.push({
        id: "completed",
        title: "Yakunlangan buyurtmalar",
        desc: `Tanlangan oraliqda ${labCompleted.count} ta buyurtma yakunlangan`,
        type: "success",
        date: today,
      });
    }

    if (topLab && topLab.count > 0) {
      items.push({
        id: "top-lab",
        title: "Eng faol laboratoriya",
        desc: `${topLab.lab} · ${topLab.count} ta buyurtma · ${formatSom(topLab.totalFinalAmount)}`,
        type: "info",
        date: today,
      });
    }

    if (sanminRangeStats.count > 0) {
      items.push({
        id: "sanmin",
        title: "San minimum",
        desc: `${sanminRangeStats.count} ta · ${formatSom(sanminRangeStats.totalAmount)} · ${sanminPaidStats.count} to'langan`,
        type: "info",
        date: today,
      });
    }

    if (isDirector && dealRangeStats.count > 0) {
      items.push({
        id: "deals",
        title: "Shartnomalar",
        desc: `${dealRangeStats.count} ta · ${formatSom(dealRangeStats.totalAmount)} · ${dealPaidStats.count} to'langan`,
        type: "info",
        date: today,
      });
    }

    const dominantPay = PAYMENT_METHODS
      .map(m => ({ ...m, stats: paymentByMethod[m.method] }))
      .sort((a, b) => b.stats.count - a.stats.count)[0];
    if (dominantPay && dominantPay.stats.count > 0) {
      items.push({
        id: "pay-method",
        title: "Asosiy to'lov usuli",
        desc: `${dominantPay.label}: ${dominantPay.stats.count} ta · ${formatSom(dominantPay.stats.totalFinalAmount)}`,
        type: "success",
        date: today,
      });
    }

    if (items.length === 0 && !labStatsLoading && !labChartLoading && !sanminStatsLoading && !dealStatsLoading) {
      items.push({
        id: "empty",
        title: "Ma'lumot yo'q",
        desc: "Tanlangan oraliqda buyurtmalar topilmadi",
        type: "info",
        date: today,
      });
    }

    return items.slice(0, 6);
  })();

  const customTooltipStyle = {
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: "12px",
    boxShadow: "0 8px 24px rgba(12,31,28,0.1)",
  };

  const trendYear = new Date().getFullYear();
  const trendRangeLabel = `Yanvar – Dekabr ${trendYear}`;

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar animate-fade-in">
      {isLabStatsRole && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-foreground tracking-tight">Statistika</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Sana oralig‘ini tanlang</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
              {DATE_PRESETS.map(preset => {
                const r = preset.range();
                const active = r.startDate === startDate && r.endDate === endDate;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyRange(r)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                      active
                        ? "text-white shadow-sm"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                    style={active ? { background: primaryColor } : undefined}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-card text-[12px] font-semibold text-foreground hover:bg-secondary/60 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{rangeLabel}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <DatePickerCalendar
                  mode="range"
                  numberOfMonths={2}
                  selected={selectedRange}
                  onSelect={onCalendarSelect}
                  defaultMonth={parseIsoDate(startDate)}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <StatCard key={i} {...s} primaryColor={primaryColor} />
        ))}
      </div>

      {isLabStatsRole && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {paymentMethodStats.map((s, i) => (
            <StatCard key={i} {...s} primaryColor={primaryColor} />
          ))}
        </div>
      )}

      <div className={`grid grid-cols-1 gap-4 ${isKassirSangig ? "" : "xl:grid-cols-3"}`}>
        {!isKassirSangig && (
        <div className="xl:col-span-2 bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-[14px] font-bold text-foreground tracking-tight">Buyurtmalar tendensiyasi</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Oylik ko&apos;rsatkich · {trendRangeLabel}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: primaryColor }} />
                <span className="text-[11px] text-muted-foreground">Buyurtmalar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span className="text-[11px] text-muted-foreground">To&apos;langan</span>
              </div>
            </div>
          </div>
          {trendLoading ? (
            <div className="h-[195px] flex items-center justify-center text-muted-foreground gap-2 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
            </div>
          ) : trendData.length === 0 ? (
            <div className="h-[195px] flex items-center justify-center text-[13px] text-muted-foreground">
              Tendensiya ma&apos;lumoti yo&apos;q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart data={trendData} margin={{ top: 5, right: 0, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={customTooltipStyle} />
                <Area type="monotone" dataKey="orders" name="Buyurtmalar" stroke={primaryColor} strokeWidth={2.5} fill="url(#gradOrders)" dot={false} />
                <Area type="monotone" dataKey="paid" name="To'langan" stroke="#059669" strokeWidth={2.5} fill="url(#gradPaid)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        )}

        <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="mb-5">
            <h3 className="text-[14px] font-bold text-foreground tracking-tight">Laboratoriyalar</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isKassirSangig
                ? "Buyurtmalar ulushi · biriktirilgan laboratoriya"
                : `Buyurtmalar ulushi · ${rangeLabel}`}
            </p>
          </div>
          {labChartLoading ? (
            <div className="h-[195px] flex items-center justify-center text-muted-foreground gap-2 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
            </div>
          ) : labChartData.length === 0 || pieTotal === 0 ? (
            <div className="h-[195px] flex items-center justify-center text-[13px] text-muted-foreground">
              Laboratoriya ma&apos;lumoti yo&apos;q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={labChartData}
                  dataKey="count"
                  nameKey="lab"
                  cx="50%"
                  cy="45%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {labChartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    ...customTooltipStyle,
                    background: "#0F1F1C",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#FFFFFF",
                  }}
                  itemStyle={{ color: "#FFFFFF" }}
                  labelStyle={{ color: "#FFFFFF" }}
                  formatter={(value: number | string, _name, item) => {
                    const row = item?.payload as LabChartRow | undefined;
                    const count = Number(value);
                    const pct = pieTotal > 0 ? Math.round((count / pieTotal) * 100) : 0;
                    const amount = row ? formatSom(row.totalFinalAmount) : "";
                    const labName = row?.lab?.trim() || String(_name || "Laboratoriya");
                    return [`${count.toLocaleString("uz-UZ")} (${pct}%) · ${amount}`, labName];
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={48}
                  formatter={(value: string) =>
                    value.length > 16 ? `${value.slice(0, 14)}…` : value
                  }
                  wrapperStyle={{ fontSize: 10 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {!isKassirSangig && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/25">
            <div>
              <h3 className="text-[14px] font-bold text-foreground tracking-tight">So&apos;nggi buyurtmalar</h3>
              <p className="text-xs text-muted-foreground">Eng yangi buyurtmalar ro&apos;yxati</p>
            </div>
            <button
              type="button"
              className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
              title="Yangilash"
              onClick={() => {
                setActivitiesLoading(true);
                const labIds = isKassirSangig ? (scopedLabIds ?? []) : null;
                void fetchRecentOrders(labIds, 8)
                  .then(result => {
                    setActivities(result.rows);
                    setActivitiesTotal(result.total);
                  })
                  .catch(() => {
                    setActivities([]);
                    setActivitiesTotal(0);
                  })
                  .finally(() => setActivitiesLoading(false));
              }}
            >
              <RefreshCw className={`w-4 h-4 ${activitiesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Turi", "Mijoz", "Operator", "Holat", "To'lov", "Sana"].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activitiesLoading && activities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                      </span>
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                      Buyurtmalar topilmadi
                    </td>
                  </tr>
                ) : (
                  activities.map(a => (
                    <tr
                      key={a.id}
                      className="border-b border-border hover:bg-secondary/35 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">{a.id}</td>
                      <td className="px-5 py-3.5 text-[12px] font-medium text-foreground whitespace-nowrap">{a.type}</td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground">{a.subject}</td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">{a.owner}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                      <td className="px-5 py-3.5"><StatusBadge status={a.payment} /></td>
                      <td className="px-5 py-3.5 text-[11px] text-muted-foreground whitespace-nowrap">{a.date}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <span className="text-xs text-muted-foreground">
              {activities.length} / {activitiesTotal.toLocaleString("uz-UZ")} ta yozuv
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
            <h3 className="text-[14px] font-bold text-foreground mb-4 tracking-tight">Tezkor ko&apos;rsatkichlar</h3>
            <div className="grid grid-cols-2 gap-2">
              {quickActions.map(action => (
                <div
                  key={action.label}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-lg border border-border text-left"
                  style={{ borderColor: `${action.color}28`, background: `${action.color}08` }}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ background: `${action.color}18` }}>
                      <action.icon className="w-3.5 h-3.5" style={{ color: action.color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground leading-tight">{action.label}</span>
                  </div>
                  <div className="text-[16px] font-extrabold text-foreground leading-none tracking-tight">
                    {action.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate w-full">{action.hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
            <h3 className="text-[14px] font-bold text-foreground mb-4 tracking-tight">Bildirishnomalar</h3>
            <div className="space-y-3">
              {(labStatsLoading || extraStatsLoading || labChartLoading) && announcements.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[13px] text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                </div>
              ) : (
                announcements.map(a => {
                  const styles = {
                    info:    { bg: "rgba(13,148,136,0.07)", border: "rgba(13,148,136,0.2)", icon: <Info className="w-3 h-3 text-teal-600" />, dot: "#0D9488" },
                    warning: { bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.2)", icon: <AlertCircle className="w-3 h-3 text-amber-600" />, dot: "#D97706" },
                    success: { bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.2)", icon: <CheckCircle className="w-3 h-3 text-emerald-600" />, dot: "#059669" },
                  }[a.type] ?? { bg: "", border: "", icon: null, dot: "" };
                  return (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg"
                      style={{ background: styles.bg, border: `1px solid ${styles.border}` }}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: `${styles.dot}20` }}>
                          {styles.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold text-foreground leading-tight">{a.title}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{a.desc}</div>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{a.date}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      <div className="bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/25">
          <div>
            <h3 className="text-[14px] font-bold text-foreground tracking-tight">So&apos;nggi san minimum</h3>
            <p className="text-xs text-muted-foreground">
              {isLabStatsRole
                ? `Eng yangi yozuvlar · oraliq: ${formatSom(sanminRangeStats.totalAmount)} (${sanminRangeStats.count} ta)`
                : "Eng yangi san minimum yozuvlari"}
            </p>
          </div>
          <button
            type="button"
            className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
            title="Yangilash"
            onClick={() => {
              setSanminLoading(true);
              void fetchRecentSanmins(8)
                .then(result => {
                  setSanminRows(result.rows);
                  setSanminTotal(result.total);
                })
                .catch(() => {
                  setSanminRows([]);
                  setSanminTotal(0);
                })
                .finally(() => setSanminLoading(false));
            }}
          >
            <RefreshCw className={`w-4 h-4 ${sanminLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["ID", "Ism", "Ish joyi", "Telefon", "To'lov usuli", "To'lov", "Summa", "Sana"].map(h => (
                  <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] px-5 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sanminLoading && sanminRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                    </span>
                  </td>
                </tr>
              ) : sanminRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                    San minimum yozuvlari topilmadi
                  </td>
                </tr>
              ) : (
                sanminRows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-border hover:bg-secondary/35 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">{row.id}</td>
                    <td className="px-5 py-3.5 text-[12px] font-medium text-foreground">{row.name}</td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground">{row.workplace}</td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">{row.phone}</td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">{row.paymentMethod}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={row.paymentStatus} /></td>
                    <td className="px-5 py-3.5 text-[12px] font-semibold text-foreground whitespace-nowrap">{row.price}</td>
                    <td className="px-5 py-3.5 text-[11px] text-muted-foreground whitespace-nowrap">{row.date}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {sanminRows.length} / {sanminTotal.toLocaleString("uz-UZ")} ta yozuv
          </span>
          {isLabStatsRole && (
            <span className="text-xs text-muted-foreground">
              {sanminStatsLoading
                ? "Statistika yuklanmoqda..."
                : `Oraliqda to'langan: ${sanminPaidStats.count.toLocaleString("uz-UZ")} · ${formatSom(sanminPaidStats.totalAmount)}`}
            </span>
          )}
        </div>
      </div>

      {isDirector && (
        <>
          <div>
            <h2 className="text-[15px] font-bold text-foreground tracking-tight">Shartnomalar</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tanlangan oraliq bo&apos;yicha shartnoma statistikasi
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              primaryColor={primaryColor}
              label="Shartnomalar"
              value={dealRangeStats.count.toLocaleString("uz-UZ")}
              description={rangeLabel}
              icon={FileText}
              iconBg="#EFF6FF"
              iconColor="#2563EB"
              loading={dealStatsLoading}
            />
            <StatCard
              primaryColor={primaryColor}
              label="Umumiy summa"
              value={formatSom(dealRangeStats.totalAmount)}
              description={`${dealRangeStats.count} ta shartnoma`}
              icon={Wallet}
              iconBg={`${primaryColor}14`}
              iconColor={primaryColor}
              loading={dealStatsLoading}
            />
            <StatCard
              primaryColor={primaryColor}
              label="To'langan"
              value={formatSom(dealPaidStats.totalAmount)}
              description={`${dealPaidStats.count} ta to'langan shartnoma`}
              icon={Banknote}
              iconBg="#ECFDF5"
              iconColor="#059669"
              loading={dealStatsLoading}
            />
            <StatCard
              primaryColor={primaryColor}
              label="To'lanmagan"
              value={formatSom(dealUnpaidStats.totalAmount)}
              description={`${dealUnpaidStats.count} ta to'lanmagan shartnoma`}
              icon={Clock3}
              iconBg="#FFFBEB"
              iconColor="#D97706"
              loading={dealStatsLoading}
            />
          </div>

          <div className="bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/25">
              <div>
                <h3 className="text-[14px] font-bold text-foreground tracking-tight">So&apos;nggi shartnomalar</h3>
                <p className="text-xs text-muted-foreground">
                  {`Eng yangi yozuvlar · oraliq: ${formatSom(dealRangeStats.totalAmount)} (${dealRangeStats.count} ta)`}
                </p>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground"
                title="Yangilash"
                onClick={() => {
                  setDealLoading(true);
                  void fetchRecentDeals(8)
                    .then(result => {
                      setDealRows(result.rows);
                      setDealTotal(result.total);
                    })
                    .catch(() => {
                      setDealRows([]);
                      setDealTotal(0);
                    })
                    .finally(() => setDealLoading(false));
                }}
              >
                <RefreshCw className={`w-4 h-4 ${dealLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["ID", "Raqam", "Nomi", "Egasi", "To'lov usuli", "To'lov", "Summa", "Sana"].map(h => (
                      <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] px-5 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dealLoading && dealRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
                        </span>
                      </td>
                    </tr>
                  ) : dealRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-muted-foreground">
                        Shartnomalar topilmadi
                      </td>
                    </tr>
                  ) : (
                    dealRows.map(row => (
                      <tr
                        key={row.id}
                        className="border-b border-border hover:bg-secondary/35 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">{row.id}</td>
                        <td className="px-5 py-3.5 text-[12px] font-semibold text-foreground whitespace-nowrap">{row.number}</td>
                        <td className="px-5 py-3.5 text-[12px] font-medium text-foreground">{row.name}</td>
                        <td className="px-5 py-3.5 text-[12px] text-foreground">{row.owner}</td>
                        <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">{row.paymentMethod}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={row.paymentStatus} /></td>
                        <td className="px-5 py-3.5 text-[12px] font-semibold text-foreground whitespace-nowrap">{row.amount}</td>
                        <td className="px-5 py-3.5 text-[11px] text-muted-foreground whitespace-nowrap">{row.date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {dealRows.length} / {dealTotal.toLocaleString("uz-UZ")} ta yozuv
              </span>
              <span className="text-xs text-muted-foreground">
                {dealStatsLoading
                  ? "Statistika yuklanmoqda..."
                  : `Oraliqda to'langan: ${dealPaidStats.count.toLocaleString("uz-UZ")} · ${formatSom(dealPaidStats.totalAmount)}`}
              </span>
            </div>
          </div>
        </>
      )}
    </main>
  );
};
