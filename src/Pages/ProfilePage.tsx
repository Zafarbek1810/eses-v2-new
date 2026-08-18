import * as React from "react";
import { useEffect, useState } from "react";
import {
  User, Mail, Shield, Building2, Calendar, Loader2, RefreshCw, AlertCircle, Edit3,
} from "lucide-react";
import { getUserById, type AppUser } from "@/api/user";
import type { AuthUser } from "@/api/auth";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ProfilePageProps = {
  primaryColor: string;
  user: AuthUser | null;
  onEditProfile: () => void;
};

function getInitials(username?: string, surname?: string) {
  const a = (username ?? "").trim().charAt(0);
  const b = (surname ?? "").trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "U";
}

export function ProfilePage({ primaryColor, user, onEditProfile }: ProfilePageProps) {
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!user?.id) {
      setLoading(false);
      setError("Foydalanuvchi topilmadi");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getUserById(user.id);
      setProfile(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profilni yuklab bo'lmadi");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [user?.id]);

  const display = profile ?? (user
    ? {
        id: user.id,
        username: user.username,
        surname: user.surname,
        email: user.email,
        createdAt: user.createdAt,
        role: user.role ?? null,
        company: user.company ?? null,
      }
    : null);

  const fullName = display
    ? [display.username, display.surname].filter(Boolean).join(" ")
    : "—";

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mening profilim</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Shaxsiy ma'lumotlaringiz</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Yangilash
          </button>
          <button
            type="button"
            onClick={onEditProfile}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-white text-[12px] font-semibold hover:opacity-90"
            style={{ background: primaryColor }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            Tahrirlash
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && !display ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: primaryColor }} />
          Yuklanmoqda...
        </div>
      ) : display ? (
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex flex-col items-center text-center">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-sm"
              style={{ background: primaryColor }}
            >
              {getInitials(display.username, display.surname)}
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">{fullName}</h3>
            <p className="text-sm text-muted-foreground mt-1 break-all">{display.email}</p>
            {display.role?.name && (
              <span
                className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-white"
                style={{ background: primaryColor }}
              >
                <Shield className="w-3 h-3" />
                {display.role.name}
              </span>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
            <h3 className="text-sm font-semibold text-foreground">Ma'lumotlar</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={User} label="Ism" value={display.username || "—"} />
              <InfoRow icon={User} label="Familiya" value={display.surname || "—"} />
              <InfoRow icon={Mail} label="Email" value={display.email || "—"} />
              <InfoRow icon={Shield} label="Rol" value={display.role?.name || "—"} />
              <InfoRow icon={Building2} label="Tashkilot" value={display.company?.name || "—"} />
              <InfoRow
                icon={Calendar}
                label="Ro'yxatdan o'tgan"
                value={display.createdAt ? formatDate(display.createdAt) : "—"}
              />
            </div>
            {display.company?.address && (
              <div className="pt-2 border-t border-border">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Tashkilot manzili
                </p>
                <p className="text-sm text-foreground">{display.company.address}</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-xl bg-secondary/60">
      <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground font-medium mt-0.5 break-words whitespace-pre-line">{value}</p>
      </div>
    </div>
  );
}
