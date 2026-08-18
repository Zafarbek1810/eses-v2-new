import * as React from "react";
import { History } from "lucide-react";

const HISTORY_ROWS = [
  {
    id: 1,
    user: "Super Admin",
    action: "Viloyat admini yaratildi",
    target: "Toshkent viloyati",
    date: "15.08.2026",
    time: "09:42",
  },
  {
    id: 2,
    user: "Super Admin",
    action: "Tarif yangilandi",
    target: "Business tarifi",
    date: "14.08.2026",
    time: "16:18",
  },
  {
    id: 3,
    user: "Super Admin",
    action: "Obuna faollashtirildi",
    target: "Medline Laboratory",
    date: "14.08.2026",
    time: "11:05",
  },
  {
    id: 4,
    user: "Super Admin",
    action: "Tashkilot ma'lumotlari yangilandi",
    target: "Sog'lom Hayot MChJ",
    date: "13.08.2026",
    time: "14:27",
  },
  {
    id: 5,
    user: "Super Admin",
    action: "Tizimga kirildi",
    target: "Boshqaruv paneli",
    date: "13.08.2026",
    time: "08:51",
  },
];

export function HistoryPage() {
  return (
    <main className="ses-scrollbar flex-1 overflow-y-auto p-6">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-foreground">Amallar tarixi</h2>
            <p className="text-xs text-muted-foreground">Super admin tomonidan bajarilgan amallar</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["№", "Foydalanuvchi", "Amal", "Obyekt", "Sana", "Vaqt"].map(header => (
                  <th
                    key={header}
                    className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HISTORY_ROWS.map(row => (
                <tr key={row.id} className="border-b border-border transition-colors last:border-b-0 hover:bg-secondary/30">
                  <td className="px-5 py-4 text-xs text-muted-foreground">{row.id}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-[13px] font-semibold text-foreground">{row.user}</td>
                  <td className="px-5 py-4 text-[13px] text-foreground">{row.action}</td>
                  <td className="px-5 py-4 text-[13px] text-muted-foreground">{row.target}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">{row.date}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-border px-5 py-3.5 text-xs text-muted-foreground">
          {HISTORY_ROWS.length} ta yozuv
        </div>
      </div>
    </main>
  );
}
