import * as React from "react";
import { useEffect, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw, Users,
  CheckCircle, AlertCircle, Loader2, Eye, EyeOff,
  ChevronLeft, ChevronsLeft, ChevronsRight, Mail, Shield, Building2,
} from "lucide-react";
import {
  getUsersFull,
  addUser,
  updateUser,
  deleteUser,
  type AppUser,
  type UserPayload,
  type UserUpdatePayload,
} from "@/api/user";
import { getAllRoles, collectScopedRoles, type Role } from "@/api/role";
import { getCompanyById } from "@/api/company";
import { getStoredCompanyId } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type UserForm = {
  username: string;
  surname: string;
  email: string;
  password: string;
  role_id: number | "";
};

const EMPTY_FORM: UserForm = {
  username: "",
  surname: "",
  email: "",
  password: "",
  role_id: "",
};

const PER_PAGE = 10;

function getInitials(username: string, surname: string) {
  const a = username.trim().charAt(0);
  const b = surname.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || "U";
}

function UserFormModal({
  mode,
  initial,
  roles,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  initial: UserForm;
  roles: Role[];
  primaryColor: string;
  saving: boolean;
  onSave: (data: UserForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UserForm>({ ...initial });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof UserForm, string>>>({});

  const set = <K extends keyof UserForm>(k: K, v: UserForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof UserForm, string>> = {};
    if (!form.username.trim() || form.username.trim().length < 2) e.username = "Kamida 2 ta belgi kiriting";
    if (!form.surname.trim()) e.surname = "Familiya kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "To'g'ri email kiriting";
    if (mode === "add") {
      if (!form.password || form.password.length < 6) e.password = "Kamida 6 ta belgi kiriting";
    } else if (form.password && form.password.length < 6) {
      e.password = "Kamida 6 ta belgi kiriting";
    }
    if (form.role_id === "" || form.role_id == null) e.role_id = "Rol tanlang";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">
              {mode === "add" ? "Yangi foydalanuvchi" : "Foydalanuvchini tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {mode === "add" ? "Barcha majburiy maydonlarni to'ldiring" : "Ma'lumotlarni yangilang"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Familiya *</label>
              <input
                type="text"
                value={form.surname}
                placeholder="aminadov"
                onChange={e => set("surname", e.target.value)}
                className={inputCls(errors.surname)}
              />
              {errors.surname && <p className="text-[11px] text-red-500 mt-1">{errors.surname}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Ism *</label>
              <input
                type="text"
                value={form.username}
                placeholder="admin"
                onChange={e => set("username", e.target.value)}
                className={inputCls(errors.username)}
              />
              {errors.username && <p className="text-[11px] text-red-500 mt-1">{errors.username}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              placeholder="zafar@gmail.com"
              onChange={e => set("email", e.target.value)}
              className={inputCls(errors.email)}
            />
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Parol {mode === "add" ? "*" : "(ixtiyoriy)"}
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={form.password}
                placeholder={mode === "edit" ? "O'zgartirish uchun yangi parol" : "Kamida 6 ta belgi"}
                onChange={e => set("password", e.target.value)}
                className={`${inputCls(errors.password)} pr-11`}
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

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Rol *</label>
            <select
              value={form.role_id === "" ? "" : String(form.role_id)}
              onChange={e => set("role_id", e.target.value ? Number(e.target.value) : "")}
              className={inputCls(errors.role_id)}
            >
              <option value="">Rol tanlang</option>
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {errors.role_id && <p className="text-[11px] text-red-500 mt-1">{errors.role_id}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6 pt-2 shrink-0 border-t border-border">
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

export function UsersSection({
  primaryColor,
  companyId,
}: {
  primaryColor: string;
  companyId?: number;
}) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add" }
    | { type: "edit"; user: AppUser }
    | { type: "delete"; user: AppUser }
    | null
  >(null);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadUsers = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      if (companyId != null) {
        const company = await getCompanyById(companyId);
        const query = s.trim().toLowerCase();
        const companyUsers = (Array.isArray(company.user) ? company.user : [])
          .map<AppUser>(user => ({
            id: user.id,
            username: user.username,
            surname: user.surname,
            email: user.email,
            createdAt: user.createdAt ?? "",
            role: user.role
              ? {
                  id: user.role.id,
                  name: user.role.name,
                  description: user.role.description ?? "",
                  createdAt: user.role.createdAt ?? "",
                }
              : null,
            company: {
              id: company.id,
              name: company.name,
              description: company.description,
              address: company.address,
              createdAt: company.createdAt,
            },
          }))
          .filter(user => {
            if (!query) return true;
            return [user.username, user.surname, user.email]
              .some(value => value.toLowerCase().includes(query));
          });
        const start = (p - 1) * PER_PAGE;
        setUsers(companyUsers.slice(start, start + PER_PAGE));
        setTotal(companyUsers.length);
        setPage(p);
        return;
      }

      const res = await getUsersFull({
        page: p,
        limit: PER_PAGE,
        search: s,
        companyId,
      });
      setUsers(res.data);
      setTotal(res.total);
      setPage(res.page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Foydalanuvchilarni yuklab bo'lmadi");
      setUsers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        if (companyId != null) {
          const [list, company] = await Promise.all([
            getAllRoles(companyId),
            getCompanyById(companyId),
          ]);
          setRoles(collectScopedRoles(Array.isArray(list) ? list : [], company, companyId));
        } else {
          const list = await getAllRoles();
          setRoles(Array.isArray(list) ? list : []);
        }
      } catch {
        setRoles([]);
      }
    })();
  }, [companyId]);

  useEffect(() => {
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, companyId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleSave = async (form: UserForm) => {
    if (!modal || (modal.type !== "add" && modal.type !== "edit")) return;
    if (form.role_id === "") return;

    setSaving(true);
    try {
      if (modal.type === "add") {
        const targetCompanyId = companyId ?? getStoredCompanyId();
        if (targetCompanyId == null) {
          pushToast("Kompaniya ID topilmadi. Qayta login qiling.", "error");
          return;
        }
        const payload: UserPayload = {
          username: form.username.trim(),
          surname: form.surname.trim(),
          email: form.email.trim(),
          password: form.password,
          role_id: form.role_id,
          company_id: targetCompanyId,
        };
        await addUser(payload);
        pushToast(`${payload.username} qo'shildi`);
      } else {
        const payload: UserUpdatePayload = {
          username: form.username.trim(),
          surname: form.surname.trim(),
          email: form.email.trim(),
          role_id: form.role_id,
        };
        if (form.password.trim()) payload.password = form.password;
        const targetCompanyId = companyId ?? getStoredCompanyId();
        if (targetCompanyId != null) payload.company_id = targetCompanyId;
        await updateUser(modal.user.id, payload);
        pushToast(`${payload.username} yangilandi`);
      }
      setModal(null);
      await loadUsers({ page: modal.type === "add" ? 1 : page });
      if (modal.type === "add") setPage(1);
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
      await deleteUser(modal.user.id);
      pushToast(`${modal.user.username} o'chirildi`, "error");
      setModal(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadUsers({ page: nextPage });
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
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Ism, familiya yoki email bo'yicha qidirish…"
              className="bg-transparent text-[13px] text-foreground placeholder-muted-foreground focus:outline-none flex-1 min-w-0"
            />
            {searchInput && (
              <button
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

          <button
            onClick={applySearch}
            className="px-3.5 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Qidirish
          </button>

          <button
            onClick={() => void loadUsers()}
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
            Yangi foydalanuvchi
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
                {["Foydalanuvchi", "Email", "Rol", "Tashkilot", "Yaratilgan", ""].map((h, i) => (
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
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Users className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Foydalanuvchi topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Yangi foydalanuvchi qo'shing yoki qidiruvni o'zgartiring</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                          style={{ background: primaryColor }}
                        >
                          {getInitials(user.username, user.surname)}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {user.username} {user.surname}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono">#{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate max-w-[200px]">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.role ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: `${primaryColor}15`, color: primaryColor }}
                        >
                          <Shield className="w-3 h-3" />
                          {user.role.name}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Rol yo'q</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {user.company ? (
                        <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground max-w-[180px]">
                          <Building2 className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{user.company.name}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setModal({ type: "edit", user })}
                          className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setModal({ type: "delete", user })}
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

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {total === 0
              ? "0 ta foydalanuvchi"
              : `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} / ${total} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…"
                  ? <span key={`el-${i}`} className="px-2 text-xs text-muted-foreground">…</span>
                  : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                      style={page === p
                        ? { background: primaryColor, color: "#fff" }
                        : { color: "var(--muted-foreground)" }
                      }
                    >
                      {p}
                    </button>
                  ),
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-4 h-4 rotate-180" />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
              className="p-1.5 rounded-lg hover:bg-secondary disabled:opacity-30 transition-colors text-muted-foreground"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {modal?.type === "add" && (
        <UserFormModal
          mode="add"
          initial={EMPTY_FORM}
          roles={roles}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <UserFormModal
          mode="edit"
          initial={{
            username: modal.user.username,
            surname: modal.user.surname,
            email: modal.user.email,
            password: "",
            role_id: modal.user.role?.id ?? "",
          }}
          roles={roles}
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
              <h2 className="text-[16px] font-bold text-foreground mb-2">Foydalanuvchini o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  {modal.user.username} {modal.user.surname}
                </span>
                {" "}ni o'chirishni xohlaysizmi?
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
