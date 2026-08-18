import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, CheckCircle, Eye, EyeOff, Loader2, MapPin,
  RefreshCw, X, Edit3, Plus, Building2,
} from "lucide-react";
import { getAllRegions, type Region } from "@/api/region";
import {
  getAllCompanies,
  addCompany,
  updateCompany,
  extractCompanyId,
  type Company,
  type CompanyPayload,
} from "@/api/company";
import { addUser, updateUser } from "@/api/user";
import { addRoleWithCompany, extractRoleId } from "@/api/role";
import { ApiError } from "@/api/client";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type AdminForm = {
  username: string;
  surname: string;
  email: string;
  password: string;
  companyName: string;
};

type RegionAdminUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  companyId: number;
  companyName: string;
};

type RegionRow = {
  region: Region;
  admin: RegionAdminUser | null;
  orgCount: number | null;
  newOrgsLastMonth: number | null;
  aiTariffs: number;
};

const EMPTY_ADMIN: AdminForm = {
  username: "",
  surname: "",
  email: "",
  password: "",
  companyName: "",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * MS_PER_DAY;

function isAdminRole(name: string | null | undefined): boolean {
  const n = name?.trim().toLowerCase();
  return n === "admin" || n === "region_admin";
}

function companyRegionId(company: Company): number | null {
  return typeof company.region?.id === "number" ? company.region.id : null;
}

function findRegionAdmin(companies: Company[], regionId: number): RegionAdminUser | null {
  for (const company of companies) {
    if (companyRegionId(company) !== regionId) continue;
    const users = Array.isArray(company.user) ? company.user : [];
    const admin = users.find(u => isAdminRole(u.role?.name));
    if (admin) {
      return {
        id: admin.id,
        username: admin.username,
        surname: admin.surname,
        email: admin.email,
        companyId: company.id,
        companyName: company.name,
      };
    }
  }
  return null;
}

function isWithinLastMonth(iso: string | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= MONTH_MS;
}

function buildRows(regions: Region[], companies: Company[]): RegionRow[] {
  return regions.map(region => {
    const admin = findRegionAdmin(companies, region.id);
    // getAllRegion.company — tashkilotlar soni uchun asosiy manba
    const orgs = Array.isArray(region.company) ? region.company : [];
    const hasData = admin != null || orgs.length > 0;

    return {
      region,
      admin,
      orgCount: hasData ? orgs.length : null,
      newOrgsLastMonth: hasData
        ? orgs.filter(c => isWithinLastMonth(c.createdAt)).length
        : null,
      aiTariffs: 0,
    };
  });
}

function AdminModal({
  mode,
  regionName,
  initial,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  mode: "add" | "edit";
  regionName: string;
  initial: AdminForm;
  primaryColor: string;
  saving: boolean;
  onSave: (data: AdminForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<AdminForm>({ ...initial });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AdminForm, string>>>({});

  const set = <K extends keyof AdminForm>(k: K, v: AdminForm[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const validate = () => {
    const e: Partial<Record<keyof AdminForm, string>> = {};
    if (!form.companyName.trim() || form.companyName.trim().length < 2) {
      e.companyName = "Kamida 2 ta belgi kiriting";
    }
    if (!form.username.trim() || form.username.trim().length < 2) {
      e.username = "Kamida 2 ta belgi kiriting";
    }
    if (!form.surname.trim()) e.surname = "Familiya kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) {
      e.email = "To'g'ri email kiriting";
    }
    if (mode === "add") {
      if (!form.password || form.password.length < 6) e.password = "Kamida 6 ta belgi kiriting";
    } else if (form.password && form.password.length < 6) {
      e.password = "Kamida 6 ta belgi kiriting";
    }
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
              {mode === "add" ? "Viloyat adminini yaratish" : "Adminni tahrirlash"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3 h-3" />
              {regionName}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Tashkilot nomi *</label>
            <input
              type="text"
              value={form.companyName}
              placeholder={`${regionName} SES`}
              onChange={e => set("companyName", e.target.value)}
              className={inputCls(errors.companyName)}
            />
            {errors.companyName && <p className="text-[11px] text-red-500 mt-1">{errors.companyName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Familiya *</label>
              <input
                type="text"
                value={form.surname}
                placeholder="Abdullayev"
                onChange={e => set("surname", e.target.value)}
                className={inputCls(errors.surname)}
              />
              {errors.surname && <p className="text-[11px] text-red-500 mt-1">{errors.surname}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Ism / login *</label>
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
              placeholder="admin@example.com"
              onChange={e => set("email", e.target.value)}
              className={inputCls(errors.email)}
            />
            {errors.email && <p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Parol {mode === "edit" ? <span className="font-normal text-muted-foreground">(ixtiyoriy)</span> : "*"}
            </label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={form.password}
                placeholder={mode === "edit" ? "O'zgartirmasangiz bo'sh qoldiring" : "••••••••"}
                onChange={e => set("password", e.target.value)}
                className={`${inputCls(errors.password)} pr-10`}
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
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (validate()) onSave(form); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Yaratish" : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

function dash(value: number | null | undefined): string {
  return value == null ? "—" : String(value);
}

export function SuperAdminRegionsPage({
  primaryColor,
  onOpenRegionCompanies,
}: {
  primaryColor: string;
  onOpenRegionCompanies?: (regionId: number) => void;
}) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "add"; row: RegionRow }
    | { type: "edit"; row: RegionRow }
    | null
  >(null);

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [regionData, companyData] = await Promise.all([
        getAllRegions(),
        getAllCompanies(),
      ]);
      setRegions(Array.isArray(regionData) ? regionData : []);
      setCompanies(Array.isArray(companyData) ? companyData : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
      setRegions([]);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => buildRows(regions, companies), [regions, companies]);

  const handleCreate = async (form: AdminForm) => {
    if (modal?.type !== "add") return;
    const region = modal.row.region;
    setSaving(true);
    try {
      const companyPayload: CompanyPayload = {
        name: form.companyName.trim(),
        description: `${region.name} viloyat administratsiyasi`,
        address: region.name,
        phone: "",
        active: true,
        region_id: region.id,
      };
      const created = await addCompany(companyPayload);
      const companyId = extractCompanyId(created);
      if (companyId == null) {
        pushToast("Tashkilot yaratildi, lekin ID topilmadi", "error");
        setModal(null);
        await load();
        return;
      }

      const roleCreated = await addRoleWithCompany({
        name: "admin",
        description: `${region.name} admin`,
        company_id: companyId,
        region_id: region.id,
      });
      const roleId = extractRoleId(roleCreated);
      if (roleId == null) {
        pushToast("Rol yaratildi, lekin ID topilmadi", "error");
        setModal(null);
        await load();
        return;
      }

      await addUser({
        username: form.username.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        password: form.password,
        role_id: roleId,
        company_id: companyId,
      });

      pushToast(`${region.name} uchun admin yaratildi`);
      setModal(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: AdminForm) => {
    if (modal?.type !== "edit" || !modal.row.admin) return;
    const { admin, region } = modal.row;
    setSaving(true);
    try {
      await updateCompany(admin.companyId, {
        name: form.companyName.trim(),
        description: `${region.name} viloyat administratsiyasi`,
        address: region.name,
        phone: "",
        active: true,
        region_id: region.id,
      });

      await updateUser(admin.id, {
        username: form.username.trim(),
        surname: form.surname.trim(),
        email: form.email.trim(),
        ...(form.password.trim() ? { password: form.password.trim() } : {}),
      });

      pushToast(`${region.name} admini yangilandi`);
      setModal(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${primaryColor}18`, color: primaryColor }}
            >
              <Building2 className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold text-foreground leading-tight">Viloyat adminlari</h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Viloyatlar bo&apos;yicha admin yaratish va monitoring
              </p>
            </div>
          </div>

          <button
            onClick={() => void load()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
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
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap w-10">#</th>
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">Viloyat</th>
                <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Oxirgi 1 oydagi yangi tashkilotlar
                </th>
                <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Tashkilotlar soni
                </th>
                <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  AI tariflar
                </th>
                <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                  Admin logini
                </th>
                <th
                  className="text-center text-[10px] font-bold uppercase tracking-wider px-4 py-3 whitespace-nowrap text-foreground"
                  style={{ background: `${primaryColor}22` }}
                >
                  (+) Admin
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Yuklanmoqda…</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center text-sm text-muted-foreground">
                    Viloyatlar topilmadi
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr
                    key={row.region.id}
                    onClick={() => {
                      if (row.admin) onOpenRegionCompanies?.(row.region.id);
                    }}
                    onKeyDown={event => {
                      if (row.admin && (event.key === "Enter" || event.key === " ")) {
                        event.preventDefault();
                        onOpenRegionCompanies?.(row.region.id);
                      }
                    }}
                    tabIndex={row.admin ? 0 : undefined}
                    title={row.admin ? `${row.region.name} tashkilotlarini ochish` : "Avval viloyatga admin biriktiring"}
                    className={`border-b border-border last:border-0 transition-colors ${
                      row.admin
                        ? "cursor-pointer hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
                        : "hover:bg-secondary/30"
                    }`}
                  >
                    <td className="px-4 py-3 text-[13px] text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-[13px] font-medium text-foreground truncate">
                          {row.region.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-[13px] tabular-nums text-foreground">
                      {dash(row.newOrgsLastMonth)}
                    </td>
                    <td className="px-4 py-3 text-center text-[13px] tabular-nums text-foreground">
                      {dash(row.orgCount)}
                    </td>
                    <td className="px-4 py-3 text-center text-[13px] tabular-nums text-muted-foreground">
                      {row.aiTariffs}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-foreground">
                      {row.admin?.username ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {row.admin ? (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            setModal({ type: "edit", row });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:bg-secondary"
                          style={{ color: primaryColor }}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          edit
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={event => {
                            event.stopPropagation();
                            setModal({ type: "add", row });
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
                          style={{ background: primaryColor }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          add
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AdminModal
          mode={modal.type}
          regionName={modal.row.region.name}
          primaryColor={primaryColor}
          saving={saving}
          initial={
            modal.type === "edit" && modal.row.admin
              ? {
                  username: modal.row.admin.username,
                  surname: modal.row.admin.surname,
                  email: modal.row.admin.email,
                  password: "",
                  companyName: modal.row.admin.companyName,
                }
              : {
                  ...EMPTY_ADMIN,
                  companyName: `${modal.row.region.name} SES`,
                }
          }
          onClose={() => !saving && setModal(null)}
          onSave={modal.type === "add" ? handleCreate : handleUpdate}
        />
      )}

      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-[13px] font-medium animate-fade-in ${
              t.type === "success"
                ? "bg-card border-border text-foreground"
                : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: primaryColor }} />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </main>
  );
}
