import type { AttendanceStats } from "@/types/acsEvent";
import { AlertTriangle, Clock3, UserCheck, Users } from "lucide-react";

type StatCard = {
  id: keyof AttendanceStats;
  label: string;
  icon: typeof Users;
  accent: string;
  soft: string;
};

const CARDS: StatCard[] = [
  { id: "totalEmployees", label: "Xodimlar soni", icon: Users, accent: "#0d9488", soft: "#ccfbf1" },
  { id: "arrived", label: "Kelganlar", icon: UserCheck, accent: "#10b981", soft: "#d1fae5" },
  { id: "late", label: "Kech kelganlar", icon: Clock3, accent: "#f59e0b", soft: "#fef3c7" },
  { id: "absent", label: "Kelmaganlar", icon: AlertTriangle, accent: "#ef4444", soft: "#fee2e2" },
];

type StatCardsProps = {
  stats: AttendanceStats;
};

export function StatCards({ stats }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {CARDS.map(card => {
        const Icon = card.icon;
        const value = stats[card.id];
        return (
          <div
            key={card.id}
            className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[var(--color-muted)]">{card.label}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
              </div>
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: card.soft, color: card.accent }}
              >
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
