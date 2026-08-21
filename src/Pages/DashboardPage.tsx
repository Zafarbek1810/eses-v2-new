import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  FileText, ClipboardCheck, Award, Building2,
  Users, Archive, Plus, Download, RefreshCw, CheckCircle,
  ArrowUpRight, ArrowDownRight, Info, AlertCircle, Filter, Calendar,
  Wallet, ClipboardList, Banknote, Clock3, Loader2, ChevronDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { getOrderTotalAmountRange, type OrderTotalAmountRange } from "@/api/order";
import { getAllLaboratories } from "@/api/laboratory";
import { getStoredUser } from "@/api/session";
import { normalizeRoleName } from "@/lib/roles";
import { Calendar as DatePickerCalendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";

const TREND_DATA = [
  { month: "Jan", applications: 245, inspections: 89 },
  { month: "Feb", applications: 312, inspections: 102 },
  { month: "Mar", applications: 289, inspections: 95 },
  { month: "Apr", applications: 402, inspections: 134 },
  { month: "May", applications: 378, inspections: 121 },
  { month: "Jun", applications: 445, inspections: 156 },
  { month: "Jul", applications: 521, inspections: 178 },
];

type LabChartRow = {
  lab: string;
  count: number;
  totalFinalAmount: number;
};

const ACTIVITIES = [
  { id: "APP-2024-1842", type: "Application", org: "Alpha Pharma LLC", status: "Pending", date: "24 Jul 2024", inspector: "A. Karimov" },
  { id: "INS-2024-0456", type: "Inspection", org: "Fresh Market #12", status: "Completed", date: "23 Jul 2024", inspector: "B. Toshmatov" },
  { id: "CERT-2024-0234", type: "Certificate", org: "Golden Food Factory", status: "Approved", date: "23 Jul 2024", inspector: "D. Yusupov" },
  { id: "APP-2024-1841", type: "Application", org: "City Hospital No.3", status: "In Review", date: "22 Jul 2024", inspector: "S. Rakhimov" },
  { id: "INS-2024-0455", type: "Inspection", org: "Sun Bakery", status: "Scheduled", date: "22 Jul 2024", inspector: "N. Mirzaev" },
  { id: "APP-2024-1840", type: "Application", org: "Omega Chemicals", status: "Rejected", date: "21 Jul 2024", inspector: "A. Karimov" },
];

const ANNOUNCEMENTS = [
  { id: 1, title: "System Maintenance", desc: "Scheduled maintenance on July 28 from 02:00–04:00 AM", type: "info", date: "24 Jul" },
  { id: 2, title: "New Regulation Update", desc: "Updated sanitary norms for food processing facilities effective Aug 1", type: "warning", date: "22 Jul" },
  { id: 3, title: "Q2 Report Available", desc: "Quarterly inspection report for Q2 2024 is now available", type: "success", date: "20 Jul" },
];

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

const StatusBadge = ({ status }: { status: string }) => {
  const MAP: Record<string, string> = {
    Pending:   "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
    Completed: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
    Approved:  "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
    "In Review": "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300",
    Scheduled: "bg-teal-50/80 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
    Rejected:  "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${MAP[status] ?? "bg-gray-50 text-gray-700"}`}>
      {status}
    </span>
  );
};

type StatCardProps = {
  label: string; value: string; description: string;
  icon: React.ElementType; trend?: number;
  iconBg: string; iconColor: string; primaryColor: string;
  loading?: boolean;
};

const StatCard = ({ label, value, description, icon: Icon, trend, iconBg, iconColor, loading }: StatCardProps) => (
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

export const DashboardPage = ({ primaryColor }: { primaryColor: string }) => {
  const role = normalizeRoleName(getStoredUser()?.role?.name);
  const isLabStatsRole =
    role === "lab_director" || role === "lab_asistant" || role === "director";

  const initialRange = useMemo(() => currentMonthRange(), []);
  const [startDate, setStartDate] = useState(initialRange.startDate);
  const [endDate, setEndDate] = useState(initialRange.endDate);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [labStatsLoading, setLabStatsLoading] = useState(isLabStatsRole);
  const [labAll, setLabAll] = useState<OrderTotalAmountRange>(emptyRange);
  const [labPaid, setLabPaid] = useState<OrderTotalAmountRange>(emptyRange);
  const [labPending, setLabPending] = useState<OrderTotalAmountRange>(emptyRange);

  const [labChartLoading, setLabChartLoading] = useState(true);
  const [labChartData, setLabChartData] = useState<LabChartRow[]>([]);

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
    if (!isLabStatsRole) return;

    let cancelled = false;

    void (async () => {
      setLabStatsLoading(true);
      try {
        const [all, paid, pendingPay] = await Promise.all([
          getOrderTotalAmountRange({ startDate, endDate }),
          getOrderTotalAmountRange({ startDate, endDate, payment_status: "paid" }),
          getOrderTotalAmountRange({ startDate, endDate, payment_status: "pending" }),
        ]);
        if (cancelled) return;
        setLabAll(all);
        setLabPaid(paid);
        setLabPending(pendingPay);
      } catch {
        if (cancelled) return;
        setLabAll(emptyRange());
        setLabPaid(emptyRange());
        setLabPending(emptyRange());
      } finally {
        if (!cancelled) setLabStatsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLabStatsRole, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLabChartLoading(true);
      try {
        const labs = await getAllLaboratories();
        if (cancelled) return;

        const list = Array.isArray(labs) ? labs : [];
        const rows: LabChartRow[] = [];

        // Parallel, lekin juda ko'p lab bo'lsa batch qilib so'raymiz
        const BATCH = 6;
        for (let i = 0; i < list.length; i += BATCH) {
          const chunk = list.slice(i, i + BATCH);
          const part = await Promise.all(
            chunk.map(async lab => {
              try {
                const stats = await getOrderTotalAmountRange({ lab_id: lab.id });
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
        setLabChartData(rows);
      } catch {
        if (!cancelled) setLabChartData([]);
      } finally {
        if (!cancelled) setLabChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const stats = isLabStatsRole ? labStats : defaultStats;

  const customTooltipStyle = {
    borderRadius: "10px",
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: "var(--foreground)",
    fontSize: "12px",
    boxShadow: "0 8px 24px rgba(12,31,28,0.1)",
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h3 className="text-[14px] font-bold text-foreground tracking-tight">Applications & Inspections Trend</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Monthly overview · January – July 2024</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm" style={{ background: primaryColor }} />
                <span className="text-[11px] text-muted-foreground">Applications</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-sm bg-emerald-500" />
                <span className="text-[11px] text-muted-foreground">Inspections</span>
              </div>
              <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={195}>
            <AreaChart data={TREND_DATA} margin={{ top: 5, right: 0, bottom: 0, left: -18 }}>
              <defs>
                <linearGradient id="gradApps" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradInsp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="applications" name="Applications" stroke={primaryColor} strokeWidth={2.5} fill="url(#gradApps)" dot={false} />
              <Area type="monotone" dataKey="inspections" name="Inspections" stroke="#059669" strokeWidth={2.5} fill="url(#gradInsp)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="mb-5">
            <h3 className="text-[14px] font-bold text-foreground tracking-tight">Laboratoriyalar</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Buyurtmalar soni · barcha laboratoriyalar
            </p>
          </div>
          {labChartLoading ? (
            <div className="h-[195px] flex items-center justify-center text-muted-foreground gap-2 text-[13px]">
              <Loader2 className="w-4 h-4 animate-spin" /> Yuklanmoqda...
            </div>
          ) : labChartData.length === 0 ? (
            <div className="h-[195px] flex items-center justify-center text-[13px] text-muted-foreground">
              Laboratoriya ma&apos;lumoti yo&apos;q
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(195, labChartData.length * 28)}>
              <BarChart
                data={labChartData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: -8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="lab"
                  type="category"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                  tickFormatter={(v: string) =>
                    v.length > 14 ? `${v.slice(0, 12)}…` : v
                  }
                />
                <Tooltip
                  contentStyle={customTooltipStyle}
                  formatter={(value: number | string) => [
                    Number(value).toLocaleString("uz-UZ"),
                    "Buyurtmalar",
                  ]}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload as LabChartRow | undefined;
                    const amount = row ? formatSom(row.totalFinalAmount) : "";
                    return amount ? `${label} · ${amount}` : String(label);
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Buyurtmalar"
                  fill={primaryColor}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 bg-card rounded-xl border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/25">
            <div>
              <h3 className="text-[14px] font-bold text-foreground tracking-tight">Recent Activities</h3>
              <p className="text-xs text-muted-foreground">Latest applications and inspections</p>
            </div>
            <div className="flex gap-1">
              <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground" title="Filter">
                <Filter className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground" title="Refresh">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground" title="Export">
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["ID", "Type", "Organization", "Inspector", "Status", "Date"].map(h => (
                    <th key={h} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ACTIVITIES.map(a => (
                  <tr
                    key={a.id}
                    className="border-b border-border hover:bg-secondary/35 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5 text-[11px] font-mono text-muted-foreground whitespace-nowrap">{a.id}</td>
                    <td className="px-5 py-3.5 text-[12px] font-medium text-foreground whitespace-nowrap">{a.type}</td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground">{a.org}</td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">{a.inspector}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={a.status} /></td>
                    <td className="px-5 py-3.5 text-[11px] text-muted-foreground whitespace-nowrap">{a.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
            <span className="text-xs text-muted-foreground">Showing 6 of 1,842 records</span>
            <button className="text-xs font-bold" style={{ color: primaryColor }}>
              View all →
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
            <h3 className="text-[14px] font-bold text-foreground mb-4 tracking-tight">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: Plus, label: "New Application", color: primaryColor },
                { icon: ClipboardCheck, label: "Start Inspection", color: "#059669" },
                { icon: Award, label: "Issue Certificate", color: "#0E7490" },
                { icon: Download, label: "Export Report", color: "#D97706" },
                { icon: Calendar, label: "Schedule Visit", color: "#0F766E" },
                { icon: Archive, label: "View Archive", color: "#5A736E" },
              ].map(action => (
                <button
                  key={action.label}
                  className="flex flex-col items-center gap-2 p-3 rounded-lg border border-border hover:shadow-sm transition-all group text-center"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${action.color}40`; (e.currentTarget as HTMLElement).style.background = `${action.color}08`; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = ""; (e.currentTarget as HTMLElement).style.background = ""; }}
                >
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: `${action.color}15` }}>
                    <action.icon className="w-4 h-4" style={{ color: action.color }} />
                  </div>
                  <span className="text-[10px] font-semibold text-foreground leading-tight">{action.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-border shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
            <h3 className="text-[14px] font-bold text-foreground mb-4 tracking-tight">Announcements</h3>
            <div className="space-y-3">
              {ANNOUNCEMENTS.map(a => {
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
              })}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};
