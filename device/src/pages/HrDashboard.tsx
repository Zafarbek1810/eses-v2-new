import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { AlertCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { fetchTodayAttendance } from "@/api/hikvision";
import { AttendanceTable } from "@/components/AttendanceTable";
import { StatCards } from "@/components/StatCards";
import type { AttendanceRow, AttendanceStats } from "@/types/acsEvent";

const EMPTY_STATS: AttendanceStats = {
  totalEmployees: 0,
  arrived: 0,
  late: 0,
  absent: 0,
};

function errorHint(message: string): string {
  if (message.includes("EHOSTUNREACH") || message.includes("tarmog'iga ulanib bo'lmadi")) {
    return [
      "Mac (192.168.1.32) kameraga (192.168.1.40) yetolmayapti — bu kod xatosi emas, tarmoq muammosi.",
      "",
      "YECHIM:",
      "1) Postman/server.js ishlaydigan kompyuterda backend ishga tushiring:",
      "     cd device && npm run server",
      "2) Mac device/.env ga shu kompyuter IP sini qo'shing:",
      "     VITE_HIKVISION_API_URL=http://SHU_PC_IP:3001",
      "3) Mac da faqat frontend qayta ishga tushiring:",
      "     cd device && npm run dev",
      "",
      "Yoki butun loyihani shu PC da oching (npm run dev + npm run server).",
    ].join("\n");
  }
  if (message.includes("Digest auth") || message.includes("401")) {
    return "device/.env faylida HIKVISION_USER=admin va HIKVISION_PASSWORD=A112233a (Postman dagi kabi) tekshiring.";
  }
  if (message.includes("502") || message.includes("ulanib bo'lmadi")) {
    return [
      "Postman ishlaydigan kompyuterda relay ishga tushiring:",
      "  cd device && npm run relay",
      "Mac .env ga qo'shing:",
      "  HIKVISION_GATEWAY=http://POSTMAN_KOMPYUTER_IP:5199",
      "",
      "Yoki butun loyihani shu kompyuterda ishga tushiring:",
      "  cd device && npm run dev",
    ].join("\n");
  }
  return "device/.env faylida HIKVISION_HOST, HIKVISION_USER va HIKVISION_PASSWORD ni tekshiring.";
}

export function HrDashboard() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [rawTotal, setRawTotal] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTodayAttendance(new Date());
      setRows(result.rows);
      setStats(result.stats);
      setRawTotal(result.rawTotalMatches);
      setLastUpdated(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ma'lumot yuklanmadi";
      setError(message);
      setRows([]);
      setStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => {
      void loadData();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  return (
    <div className="min-h-full bg-[var(--color-background)]">
      <header className="border-b border-[var(--color-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[var(--color-primary)]">
              <ShieldCheck className="h-4 w-4" />
              SES HR
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Davomat nazorati</h1>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Hikvision kirish nazorati · {format(new Date(), "dd.MM.yyyy")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Kamera bilan bog&apos;lanib bo&apos;lmadi</p>
              <p className="mt-1 text-sm">{error}</p>
              <p className="mt-2 whitespace-pre-line text-xs text-red-600/80">
                {errorHint(error)}
              </p>
            </div>
          </div>
        )}

        <StatCards stats={stats} />

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-muted)]">
          <span>Jami hodisalar: {rawTotal}</span>
          {lastUpdated && <span>Oxirgi yangilanish: {format(lastUpdated, "HH:mm:ss")}</span>}
          <span>Avtomatik yangilanish: har 60 soniyada</span>
        </div>

        <AttendanceTable rows={rows} loading={loading} />
      </main>
    </div>
  );
}
