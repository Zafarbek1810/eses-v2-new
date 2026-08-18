import * as React from "react";
import { useEffect, useState } from "react";
import {
  Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, User, ArrowLeft,
} from "lucide-react";
import { getUserById, updateUser, type UserUpdatePayload } from "@/api/user";
import type { AuthUser } from "@/api/auth";
import { setStoredUser } from "@/api/session";
import { ApiError } from "@/api/client";

type EditProfilePageProps = {
  primaryColor: string;
  user: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
  onBackToProfile: () => void;
};

type FormState = {
  username: string;
  surname: string;
  email: string;
  password: string;
};

export function EditProfilePage({
  primaryColor,
  user,
  onUserUpdated,
  onBackToProfile,
}: EditProfilePageProps) {
  const [form, setForm] = useState<FormState>({
    username: "",
    surname: "",
    email: "",
    password: "",
  });
  const [roleId, setRoleId] = useState<number | undefined>();
  const [companyId, setCompanyId] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void getUserById(user.id)
      .then(data => {
        if (cancelled) return;
        setForm({
          username: data.username ?? "",
          surname: data.surname ?? "",
          email: data.email ?? "",
          password: "",
        });
        setRoleId(data.role?.id);
        setCompanyId(data.company?.id);
      })
      .catch(() => {
        if (cancelled) return;
        setForm({
          username: user.username ?? "",
          surname: user.surname ?? "",
          email: user.email ?? "",
          password: "",
        });
        setRoleId(user.role?.id);
        setCompanyId(user.company?.id);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.username.trim() || form.username.trim().length < 2) e.username = "Kamida 2 ta belgi kiriting";
    if (!form.surname.trim()) e.surname = "Familiya kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "To'g'ri email kiriting";
    if (form.password && form.password.length < 6) e.password = "Kamida 6 ta belgi kiriting";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!user?.id || !validate()) return;
    setSaving(true);
    try {
      const payload: UserUpdatePayload = {
        username: form.username.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
      };
      if (roleId != null) payload.role_id = roleId;
      if (companyId != null) payload.company_id = companyId;
      if (form.password.trim()) payload.password = form.password.trim();

      const updated = await updateUser(user.id, payload);
      const next: AuthUser = {
        ...user,
        username: updated.username ?? payload.username,
        surname: updated.surname ?? payload.surname,
        email: updated.email ?? payload.email,
        role: updated.role ?? user.role ?? null,
        company: updated.company ?? user.company ?? null,
      };
      setStoredUser(next);
      onUserUpdated(next);
      setForm(f => ({ ...f, password: "" }));
      setToast({ text: "Profil muvaffaqiyatli yangilandi", type: "success" });
    } catch (err) {
      setToast({
        text: err instanceof ApiError ? err.message : "Profilni yangilab bo'lmadi",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  if (!user) {
    return (
      <main className="flex-1 overflow-y-auto p-6 ses-scrollbar">
        <div className="flex items-center gap-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          Foydalanuvchi topilmadi
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm text-white ${
            toast.type === "success" ? "bg-emerald-600" : "bg-red-600"
          }`}
        >
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Profilni tahrirlash</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Shaxsiy ma'lumotlarni yangilang</p>
        </div>
        <button
          type="button"
          onClick={onBackToProfile}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary text-[12px] font-semibold text-foreground hover:opacity-90"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Profilga qaytish
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: primaryColor }} />
          Yuklanmoqda...
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 max-w-xl space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-border">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold"
              style={{ background: primaryColor }}
            >
              <User className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Asosiy ma'lumotlar</p>
              <p className="text-xs text-muted-foreground">Ism, familiya, email va parol</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Ism *</label>
              <input
                type="text"
                value={form.username}
                onChange={e => set("username", e.target.value)}
                className={inputCls(errors.username)}
                placeholder="Ism"
              />
              {errors.username && <p className="text-[11px] text-red-500 mt-1">{errors.username}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Familiya *</label>
              <input
                type="text"
                value={form.surname}
                onChange={e => set("surname", e.target.value)}
                className={inputCls(errors.surname)}
                placeholder="Familiya"
              />
              {errors.surname && <p className="text-[11px] text-red-500 mt-1">{errors.surname}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              className={inputCls(errors.email)}
              placeholder="email@example.com"
            />
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Yangi parol <span className="font-normal text-muted-foreground">(ixtiyoriy)</span>
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={form.password}
                onChange={e => set("password", e.target.value)}
                className={`${inputCls(errors.password)} pr-11`}
                placeholder="O'zgartirmasangiz bo'sh qoldiring"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
              style={{ background: primaryColor }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Saqlash
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
