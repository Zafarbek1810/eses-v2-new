import { useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import type { AttendanceRow } from "@/types/acsEvent";

type AttendanceTableProps = {
  rows: AttendanceRow[];
  loading?: boolean;
};

function PhotoCell({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
      onError={() => setFailed(true)}
    />
  );
}

export function AttendanceTable({ rows, loading }: AttendanceTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold">Bugungi davomat</h2>
          <p className="text-sm text-[var(--color-muted)]">Hikvision kirish-chiqish hodisalari asosida</p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Yangilanmoqda...
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-[var(--color-muted)]">
            <tr>
              <th className="px-5 py-3 font-semibold">Rasm</th>
              <th className="px-5 py-3 font-semibold">Familiya</th>
              <th className="px-5 py-3 font-semibold">Ism</th>
              <th className="px-5 py-3 font-semibold">Bo&apos;lim</th>
              <th className="px-5 py-3 font-semibold">Kelgan vaqt</th>
              <th className="px-5 py-3 font-semibold">Ketgan vaqt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-[var(--color-muted)]">
                  Bugun uchun hodisalar topilmadi
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr key={row.id} className="border-t border-[var(--color-border)]">
                  <td className="px-5 py-3">
                    <PhotoCell src={row.picturePath} name={`${row.surname} ${row.firstName}`} />
                  </td>
                  <td className="px-5 py-3 font-medium">{row.surname}</td>
                  <td className="px-5 py-3">{row.firstName}</td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">{row.department}</td>
                  <td className="px-5 py-3">
                    <span className={row.isLate ? "font-semibold text-amber-600" : "font-medium text-emerald-600"}>
                      {row.arrivalTime ?? "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--color-muted)]">{row.departureTime ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
