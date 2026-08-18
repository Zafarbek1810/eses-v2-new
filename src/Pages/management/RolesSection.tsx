import * as React from "react";
import { useEffect, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw,
  Shield, CheckCircle, AlertCircle, Loader2,
} from "lucide-react";
import {
  getAllRoles,
  addRole,
  addRoleWithCompany,
  updateRole,
  deleteRole,
  type Role,
  type RolePayload,
} from "@/api/role";
import { ApiError } from "@/api/client";
import { getCompanyById } from "@/api/company";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

const EMPTY_FORM: RolePayload = { name: "", description: "" };

const RESERVED_ROLE_NAMES = new Set(["director", "admin"]);

function isReservedRoleName(name: string): boolean {
  return RESERVED_ROLE_NAMES.has(name.trim().toLowerCase());
}

function RoleFormModal({
  mode,
  initial,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  initial: RolePayload;
  primaryColor: string;
  saving: boolean;
  onSave: (data: RolePayload) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<RolePayload>({ ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof RolePayload, string>>>({});

  const set = (k: keyof RolePayload, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: typeof errors = {};
    const name = form.name.trim();
    if (!name || name.length < 2) {
      e.name = "Kamida 2 ta belgi kiriting";
    } else if (isReservedRoleName(name)) {
      e.name = `"${name}" roli tizim tomonidan band — boshqa nom tanlang`;
    }
    if (!form.description.trim()) e.description = "Tavsif kiritilishi shart";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">
              {mode === "add" ? "Yangi rol qo'shish" : "Rolni tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Name va description maydonlarini to'ldiring
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
            <input
              type="text"
              value={form.name}
              placeholder="Masalan: inspector"
              onChange={e => set("name", e.target.value)}
              className={`w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
                errors.name ? "border-red-400" : "border-border focus:border-[var(--primary)]"
              }`}
            />
            {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Tavsif *</label>
            <textarea
              value={form.description}
              placeholder="Rol haqida qisqacha"
              rows={3}
              onChange={e => set("description", e.target.value)}
              className={`w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none resize-none ${
                errors.description ? "border-red-400" : "border-border focus:border-[var(--primary)]"
              }`}
            />
            {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={() => { if (validate()) onSave(form); }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Qo'shish" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RolesSection({
  primaryColor,
  companyId,
}: {
  primaryColor: string;
  companyId?: number;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; role: Role }
    | { type: "delete"; role: Role }
    | null
  >(null);

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadRoles = async () => {
    setLoading(true);
    setError(null);
    try {
      if (companyId != null) {
        const [data, company] = await Promise.all([
          getAllRoles(companyId),
          getCompanyById(companyId),
        ]);
        const scoped = (Array.isArray(data) ? data : []).filter(role => {
          const id = role.company?.id ?? role.company_id ?? role.companyId;
          return id === companyId;
        });
        const byId = new Map(scoped.map(role => [role.id, role]));
        for (const user of Array.isArray(company.user) ? company.user : []) {
          if (!user.role || byId.has(user.role.id)) continue;
          byId.set(user.role.id, {
            id: user.role.id,
            name: user.role.name,
            description: user.role.description ?? "",
            createdAt: user.role.createdAt ?? "",
            user: [],
          });
        }
        setRoles([...byId.values()]);
      } else {
        const data = await getAllRoles();
        setRoles(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      const msg = err instanceof ApiError
        ? err.message
        : "Rollarni yuklab bo'lmadi. Serverni tekshiring.";
      setError(msg);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoles();
  }, [companyId]);

  const filtered = roles.filter(r => {
    const q = search.toLowerCase();
    return !q || r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
  });

  const handleSave = async (form: RolePayload) => {
    if (!modal || (modal.type !== "add" && modal.type !== "edit")) return;
    if (isReservedRoleName(form.name)) {
      pushToast(`"${form.name.trim()}" roli yaratib yoki o'zgartirib bo'lmaydi`, "error");
      return;
    }
    setSaving(true);
    try {
      if (modal.type === "add") {
        if (companyId != null) {
          await addRoleWithCompany({ ...form, company_id: companyId });
        } else {
          await addRole(form);
        }
        pushToast(`"${form.name}" roli qo'shildi`);
      } else {
        await updateRole(modal.role.id, form);
        pushToast(`"${form.name}" roli yangilandi`);
      }
      setModal(null);
      await loadRoles();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteRole(modal.role.id);
      pushToast(`"${modal.role.name}" o'chirildi`, "error");
      setModal(null);
      await loadRoles();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rol nomi yoki tavsif bo'yicha qidirish…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            onClick={() => void loadRoles()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setModal({ type: "add" })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" />
            Yangi rol
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 dark:bg-red-950/30 dark:border-red-800">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-xs leading-relaxed">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["ID", "Nomi", "Tavsif", "Foydalanuvchilar", "Yaratilgan", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Shield className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Rol topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Yangi rol qo'shing yoki qidiruvni o'zgartiring</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(role => (
                  <tr key={role.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5 text-[12px] font-mono text-muted-foreground">{role.id}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `${primaryColor}18` }}
                        >
                          <Shield className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                        </div>
                        <span className="text-[13px] font-semibold text-foreground">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground max-w-[280px]">
                      <span className="line-clamp-2">{role.description}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-foreground">
                      {Array.isArray(role.user) ? role.user.length : 0}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(role.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "edit", role })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", role })}
                          className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                          title="O'chirish"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-border">
          <span className="text-xs text-muted-foreground">{filtered.length} ta rol</span>
        </div>
      </div>

      {modal?.type === "add" && (
        <RoleFormModal
          mode="add"
          initial={EMPTY_FORM}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <RoleFormModal
          mode="edit"
          initial={{ name: modal.role.name, description: modal.role.description }}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Rolni o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{modal.role.name}</span> rolini o'chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium animate-fade-in pointer-events-auto ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            }
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
