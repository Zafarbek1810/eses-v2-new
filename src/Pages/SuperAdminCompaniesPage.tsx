import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, X, Edit3, Trash2, RefreshCw, Building2,
  CheckCircle, AlertCircle, Loader2, Eye, EyeOff,
  ChevronLeft, ChevronsLeft, ChevronsRight, MapPin, ArrowLeft,
} from "lucide-react";
import {
  getAllCompanies,
  addCompany,
  updateCompany,
  deleteCompany,
  extractCompanyId,
  findCompanyDirector,
  type Company,
  type CompanyPayload,
} from "@/api/company";
import { getAllRegions, type Region } from "@/api/region";
import { addUser } from "@/api/user";
import { addRoleWithCompany, extractRoleId } from "@/api/role";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type CompanyForm = {
  name: string;
  description: string;
  address: string;
  phone: string;
  active: boolean;
  region_id: number | "";
  district_id: number | "";
};

type AdminForm = {
  username: string;
  surname: string;
  email: string;
  password: string;
};

type CreateForm = CompanyForm & AdminForm;

/** Edit: company fields + director employee (password optional). */
type EditForm = CompanyForm & AdminForm;

const PHONE_PREFIX = "+998";
const PHONE_PATTERN = /^\+998\d{9}$/;

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.startsWith("998") ? digits.slice(3) : digits;
  return PHONE_PREFIX + local.slice(0, 9);
}

/** Empty / only prefix → ""; otherwise full +998XXXXXXXXX */
function normalizeOptionalPhone(raw: string): string {
  const phone = formatPhoneNumber(raw);
  return phone === PHONE_PREFIX ? "" : phone;
}

function companyMatchesSearch(company: Company, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [
    company.name,
    company.description,
    company.address,
    company.phone,
    company.region?.name,
    company.district?.name,
  ].some(v => typeof v === "string" && v.toLowerCase().includes(q));
}

function getCompanyDistrictId(company: Company): number | null {
  if (typeof company.district?.id === "number") return company.district.id;
  if (typeof company.districtId === "number") return company.districtId;
  if (typeof company.district_id === "number") return company.district_id;
  return null;
}

function resolveDistrictName(company: Company, regions: Region[]): string | null {
  if (company.district?.name) return company.district.name;
  const districtId = getCompanyDistrictId(company);
  if (districtId == null) return null;
  for (const region of regions) {
    const found = region.district?.find(d => d.id === districtId);
    if (found) return found.name;
  }
  return null;
}

function toCompanyPayload(form: CompanyForm): CompanyPayload {
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    address: form.address.trim(),
    phone: normalizeOptionalPhone(form.phone),
    active: form.active,
    region_id: Number(form.region_id),
    district_id: Number(form.district_id),
  };
}

const EMPTY_COMPANY: CompanyForm = {
  name: "",
  description: "",
  address: "",
  phone: PHONE_PREFIX,
  active: true,
  region_id: "",
  district_id: "",
};

const EMPTY_ADMIN: AdminForm = {
  username: "",
  surname: "",
  email: "",
  password: "",
};

const DEFAULT_COMPANY_ROLE = "director";

const PER_PAGE = 10;

function RegionDistrictFields({
  regionId,
  districtId,
  regions,
  regionsLoading,
  regionLocked,
  errors,
  onRegionChange,
  onDistrictChange,
  inputCls,
}: {
  regionId: number | "";
  districtId: number | "";
  regions: Region[];
  regionsLoading: boolean;
  regionLocked: boolean;
  errors: { region_id?: string; district_id?: string };
  onRegionChange: (id: number | "") => void;
  onDistrictChange: (id: number | "") => void;
  inputCls: (err?: string) => string;
}) {
  const districts = useMemo(() => {
    if (regionId === "") return [];
    return regions.find(r => r.id === regionId)?.district ?? [];
  }, [regionId, regions]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">Viloyat *</label>
        <select
          value={regionId === "" ? "" : String(regionId)}
          onChange={e => onRegionChange(e.target.value ? Number(e.target.value) : "")}
          disabled={regionsLoading || regionLocked}
          className={inputCls(errors.region_id)}
        >
          <option value="">{regionsLoading ? "Yuklanmoqda..." : "Viloyat tanlang"}</option>
          {regions.map(r => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        {errors.region_id && <p className="text-[11px] text-red-500 mt-1">{errors.region_id}</p>}
      </div>
      <div>
        <label className="block text-xs font-semibold text-foreground mb-1.5">Tuman *</label>
        <select
          value={districtId === "" ? "" : String(districtId)}
          onChange={e => onDistrictChange(e.target.value ? Number(e.target.value) : "")}
          disabled={regionId === ""}
          className={inputCls(errors.district_id)}
        >
          <option value="">
            {regionId === "" ? "Avval viloyat tanlang" : "Tuman tanlang"}
          </option>
          {districts.map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {errors.district_id && <p className="text-[11px] text-red-500 mt-1">{errors.district_id}</p>}
      </div>
    </div>
  );
}

function CompanyEditModal({
  initial,
  hasDirector,
  regions,
  regionsLoading,
  regionLocked,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  initial: EditForm;
  hasDirector: boolean;
  regions: Region[];
  regionsLoading: boolean;
  regionLocked: boolean;
  primaryColor: string;
  saving: boolean;
  onSave: (data: EditForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<EditForm>({ ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof EditForm, string>>>({});

  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "region_id") next.district_id = "";
      return next;
    });
    setErrors(e => ({ ...e, [k]: undefined, ...(k === "region_id" ? { district_id: undefined } : {}) }));
  };

  const validate = () => {
    const e: Partial<Record<keyof EditForm, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!form.description.trim()) e.description = "Tavsif kiritilishi shart";
    if (!form.address.trim()) e.address = "Manzil kiritilishi shart";
    if (form.region_id === "") e.region_id = "Viloyatni tanlang";
    if (form.district_id === "") e.district_id = "Tumanni tanlang";
    const phone = formatPhoneNumber(form.phone);
    if (phone !== PHONE_PREFIX && !PHONE_PATTERN.test(phone)) {
      e.phone = "Format: +998 dan keyin 9 ta raqam";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none ${
      err ? "border-red-400" : "border-border focus:border-[var(--primary)]"
    }`;

  const disabledInputCls =
    "w-full bg-secondary/60 border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-muted-foreground cursor-not-allowed opacity-80";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Tashkilotni tahrirlash</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ma'lumotlarni yangilang</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Tashkilot ma'lumotlari
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Masalan: Urganch SES"
                  onChange={e => set("name", e.target.value)}
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Tavsif *</label>
                <textarea
                  value={form.description}
                  placeholder="Tashkilot haqida qisqacha"
                  rows={2}
                  onChange={e => set("description", e.target.value)}
                  className={`${inputCls(errors.description)} resize-none`}
                />
                {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
              </div>
              <RegionDistrictFields
                regionId={form.region_id}
                districtId={form.district_id}
                regions={regions}
                regionsLoading={regionsLoading}
                regionLocked={regionLocked}
                errors={{ region_id: errors.region_id, district_id: errors.district_id }}
                onRegionChange={id => set("region_id", id)}
                onDistrictChange={id => set("district_id", id)}
                inputCls={inputCls}
              />
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Manzil *</label>
                <input
                  type="text"
                  value={form.address}
                  placeholder="Shahar, ko'cha…"
                  onChange={e => set("address", e.target.value)}
                  className={inputCls(errors.address)}
                />
                {errors.address && <p className="text-[11px] text-red-500 mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Telefon <span className="font-normal text-muted-foreground">(ixtiyoriy)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone || PHONE_PREFIX}
                  placeholder="+998901234567"
                  onChange={e => set("phone", formatPhoneNumber(e.target.value))}
                  onFocus={e => {
                    if (!form.phone || form.phone === PHONE_PREFIX) {
                      set("phone", PHONE_PREFIX);
                    }
                    const el = e.currentTarget;
                    requestAnimationFrame(() => {
                      if (el.selectionStart != null && el.selectionStart < PHONE_PREFIX.length) {
                        el.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                      }
                    });
                  }}
                  onKeyDown={e => {
                    const input = e.currentTarget;
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    const touchingPrefix =
                      start < PHONE_PREFIX.length || (start === end && start <= PHONE_PREFIX.length && e.key === "Backspace");
                    if ((e.key === "Backspace" || e.key === "Delete") && touchingPrefix && end <= PHONE_PREFIX.length) {
                      e.preventDefault();
                      input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                    }
                  }}
                  className={inputCls(errors.phone)}
                />
                {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Holat</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {form.active ? "Tashkilot faol" : "Tashkilot faol emas"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set("active", !form.active)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    form.active ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {hasDirector && (
            <div className="border-t border-border pt-5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Biriktirilgan xodim (director)
              </p>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Familiya</label>
                    <input
                      type="text"
                      value={form.surname}
                      disabled
                      readOnly
                      className={disabledInputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Ism</label>
                    <input
                      type="text"
                      value={form.username}
                      disabled
                      readOnly
                      className={disabledInputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    disabled
                    readOnly
                    className={disabledInputCls}
                  />
                </div>
              </div>
            </div>
          )}
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
            onClick={() => {
              if (!validate()) return;
              onSave({ ...form, phone: normalizeOptionalPhone(form.phone) });
            }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Saqlash
          </button>
        </div>
      </div>
    </div>
  );
}

function CompanyCreateModal({
  primaryColor,
  saving,
  regions,
  regionsLoading,
  lockedRegionId,
  onSave,
  onClose,
}: {
  primaryColor: string;
  saving: boolean;
  regions: Region[];
  regionsLoading: boolean;
  lockedRegionId: number | null;
  onSave: (data: CreateForm) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateForm>({
    ...EMPTY_COMPANY,
    ...EMPTY_ADMIN,
    region_id: lockedRegionId ?? "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});

  const set = <K extends keyof CreateForm>(k: K, v: CreateForm[K]) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "region_id") next.district_id = "";
      return next;
    });
    setErrors(e => ({ ...e, [k]: undefined, ...(k === "region_id" ? { district_id: undefined } : {}) }));
  };

  const validate = () => {
    const e: Partial<Record<keyof CreateForm, string>> = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = "Kamida 2 ta belgi kiriting";
    if (!form.description.trim()) e.description = "Tavsif kiritilishi shart";
    if (!form.address.trim()) e.address = "Manzil kiritilishi shart";
    if (form.region_id === "") e.region_id = "Viloyatni tanlang";
    if (form.district_id === "") e.district_id = "Tumanni tanlang";
    const phone = formatPhoneNumber(form.phone);
    if (phone !== PHONE_PREFIX && !PHONE_PATTERN.test(phone)) {
      e.phone = "Format: +998 dan keyin 9 ta raqam";
    }
    if (!form.username.trim() || form.username.trim().length < 2) e.username = "Kamida 2 ta belgi kiriting";
    if (!form.surname.trim()) e.surname = "Familiya kiritilishi shart";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = "To'g'ri email kiriting";
    if (!form.password || form.password.length < 6) e.password = "Kamida 6 ta belgi kiriting";
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
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Yangi tashkilot</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tashkilot, rol va admin xodim birga yaratiladi
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Tashkilot ma'lumotlari
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Nomi *</label>
                <input
                  type="text"
                  value={form.name}
                  placeholder="Masalan: Urganch SES"
                  onChange={e => set("name", e.target.value)}
                  className={inputCls(errors.name)}
                />
                {errors.name && <p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Tavsif *</label>
                <textarea
                  value={form.description}
                  placeholder="Tashkilot haqida qisqacha"
                  rows={2}
                  onChange={e => set("description", e.target.value)}
                  className={`${inputCls(errors.description)} resize-none`}
                />
                {errors.description && <p className="text-[11px] text-red-500 mt-1">{errors.description}</p>}
              </div>
              <RegionDistrictFields
                regionId={form.region_id}
                districtId={form.district_id}
                regions={regions}
                regionsLoading={regionsLoading}
                regionLocked={lockedRegionId != null}
                errors={{ region_id: errors.region_id, district_id: errors.district_id }}
                onRegionChange={id => set("region_id", id)}
                onDistrictChange={id => set("district_id", id)}
                inputCls={inputCls}
              />
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">Manzil *</label>
                <input
                  type="text"
                  value={form.address}
                  placeholder="Shahar, ko'cha…"
                  onChange={e => set("address", e.target.value)}
                  className={inputCls(errors.address)}
                />
                {errors.address && <p className="text-[11px] text-red-500 mt-1">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Telefon <span className="font-normal text-muted-foreground">(ixtiyoriy)</span>
                </label>
                <input
                  type="tel"
                  value={form.phone || PHONE_PREFIX}
                  placeholder="+998901234567"
                  onChange={e => set("phone", formatPhoneNumber(e.target.value))}
                  onFocus={e => {
                    if (!form.phone || form.phone === PHONE_PREFIX) {
                      set("phone", PHONE_PREFIX);
                    }
                    const el = e.currentTarget;
                    requestAnimationFrame(() => {
                      if (el.selectionStart != null && el.selectionStart < PHONE_PREFIX.length) {
                        el.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                      }
                    });
                  }}
                  onKeyDown={e => {
                    const input = e.currentTarget;
                    const start = input.selectionStart ?? 0;
                    const end = input.selectionEnd ?? 0;
                    const touchingPrefix =
                      start < PHONE_PREFIX.length || (start === end && start <= PHONE_PREFIX.length && e.key === "Backspace");
                    if ((e.key === "Backspace" || e.key === "Delete") && touchingPrefix && end <= PHONE_PREFIX.length) {
                      e.preventDefault();
                      input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                    }
                  }}
                  className={inputCls(errors.phone)}
                />
                {errors.phone && <p className="text-[11px] text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-3.5 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">Holat</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {form.active ? "Tashkilot faol" : "Tashkilot faol emas"}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.active}
                  onClick={() => set("active", !form.active)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    form.active ? "bg-emerald-500" : "bg-muted-foreground/30"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      form.active ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
              Admin xodim
            </p>
            <div className="space-y-4">
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
                  <label className="block text-xs font-semibold text-foreground mb-1.5">Ism *</label>
                  <input
                    type="text"
                    value={form.username}
                    placeholder="Shoxrux"
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
                <label className="block text-xs font-semibold text-foreground mb-1.5">Parol *</label>
                <div className="relative">
                  <input
                    type={showPwd ? "text" : "password"}
                    value={form.password}
                    placeholder="Kamida 6 ta belgi"
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
            </div>
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
            onClick={() => {
              if (!validate()) return;
              onSave({ ...form, phone: normalizeOptionalPhone(form.phone) });
            }}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: primaryColor }}
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Yaratish
          </button>
        </div>
      </div>
    </div>
  );
}

export function SuperAdminCompaniesPage({
  primaryColor,
  scopedRegionId,
  onBack,
  onOpenCompany,
}: {
  primaryColor: string;
  scopedRegionId: number;
  onBack: () => void;
  onOpenCompany?: (company: Company) => void;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
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
    | { type: "edit"; company: Company }
    | { type: "delete"; company: Company }
    | null
  >(null);

  const canManage = true;
  const lockedRegionId = scopedRegionId;
  const regionReady = true;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const loadRegions = async () => {
    setRegionsLoading(true);
    try {
      const data = await getAllRegions();
      setRegions(Array.isArray(data) ? data : []);
    } catch {
      setRegions([]);
    } finally {
      setRegionsLoading(false);
    }
  };

  const loadCompanies = async (opts?: { page?: number; search?: string }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? search;
    setLoading(true);
    setError(null);
    try {
      // Super admin viloyat bo'yicha tashkilotlarni ko'radi.
      const all = await getAllCompanies();
      const filtered = (Array.isArray(all) ? all : []).filter(
        c => c.region?.id === lockedRegionId && companyMatchesSearch(c, s.trim()),
      );
      const start = (p - 1) * PER_PAGE;
      setCompanies(filtered.slice(start, start + PER_PAGE));
      setTotal(filtered.length);
      setPage(p);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Tashkilotlarni yuklab bo'lmadi");
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegions();
  }, []);

  useEffect(() => {
    void loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, lockedRegionId]);

  const applySearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCreate = async (form: CreateForm) => {
    if (!canManage) return;
    setSaving(true);
    try {
      const companyPayload = toCompanyPayload({
        ...form,
        region_id: lockedRegionId ?? form.region_id,
      });
      const created = await addCompany(companyPayload);
      const companyId = extractCompanyId(created);

      if (companyId == null) {
        pushToast("Tashkilot yaratildi, lekin ID topilmadi — rol va admin biriktirilmadi", "error");
        setModal(null);
        setPage(1);
        await loadCompanies({ page: 1 });
        return;
      }

      const roleCreated = await addRoleWithCompany({
        name: DEFAULT_COMPANY_ROLE,
        description: DEFAULT_COMPANY_ROLE,
        company_id: companyId,
        ...(typeof companyPayload.region_id === "number"
          ? { region_id: companyPayload.region_id }
          : {}),
      });
      const roleId = extractRoleId(roleCreated);

      if (roleId == null) {
        pushToast("Tashkilot va rol yaratildi, lekin rol ID topilmadi — admin biriktirilmadi", "error");
        setModal(null);
        setPage(1);
        await loadCompanies({ page: 1 });
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

      pushToast(`"${companyPayload.name}" yaratildi`);
      setModal(null);
      setPage(1);
      await loadCompanies({ page: 1 });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: EditForm) => {
    if (!canManage || modal?.type !== "edit") return;
    setSaving(true);
    try {
      const payload = toCompanyPayload({
        ...form,
        region_id: lockedRegionId ?? form.region_id,
      });
      await updateCompany(modal.company.id, payload);

      pushToast(`"${payload.name}" yangilandi`);
      setModal(null);
      await loadCompanies();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canManage || modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deleteCompany(modal.company.id);
      pushToast(`"${modal.company.name}" o'chirildi`, "error");
      setModal(null);
      const nextTotal = total - 1;
      const nextPage = page > Math.ceil(nextTotal / PER_PAGE) ? Math.max(1, page - 1) : page;
      if (nextPage !== page) setPage(nextPage);
      else await loadCompanies({ page: nextPage });
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-[13px] font-semibold text-foreground transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" />
          Viloyat adminlariga qaytish
        </button>
      )}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
          <div className="flex items-center gap-2 bg-secondary rounded-xl px-3.5 py-2.5 flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") applySearch(); }}
              placeholder="Nomi, tavsif yoki manzil bo'yicha qidirish…"
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
            onClick={() => void loadCompanies()}
            className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          {canManage && (
            <button
              onClick={() => setModal({ type: "add" })}
              disabled={!regionReady}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm disabled:opacity-60"
              style={{ background: primaryColor }}
            >
              <Plus className="w-4 h-4" />
              Yangi tashkilot
            </button>
          )}
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
                {["Tashkilot", "Viloyat / Tuman", "Telefon", "Manzil", "Holat", "Yaratilgan", ""].map((h, i) => (
                  <th key={i} className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Tashkilot topilmadi</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {canManage
                            ? "Yangi tashkilot qo'shing yoki qidiruvni o'zgartiring"
                            : "Qidiruvni o'zgartiring yoki keyinroq qayta urinib ko'ring"}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map(company => (
                  <tr
                    key={company.id}
                    onClick={() => onOpenCompany?.(company)}
                    className={`border-b border-border hover:bg-secondary/30 transition-colors group ${
                      onOpenCompany ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                          style={{ background: primaryColor }}
                        >
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-foreground leading-tight">
                            {company.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1 max-w-[200px]">
                            {company.description || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-[12px] text-foreground leading-tight">
                        {company.region?.name || "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {resolveDistrictName(company, regions) || "—"}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap font-mono">
                      {company.phone || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground max-w-[220px]">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{company.address}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-[11px] font-semibold ${
                          company.active
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                        }`}
                      >
                        {company.active ? "Faol" : "Faol emas"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                      {formatDate(company.createdAt)}
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              setModal({ type: "edit", company });
                            }}
                            className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={event => {
                              event.stopPropagation();
                              setModal({ type: "delete", company });
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-50 hover:text-red-500 text-muted-foreground transition-colors"
                            title="O'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
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
              ? "0 ta tashkilot"
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

      {canManage && modal?.type === "add" && (
        <CompanyCreateModal
          primaryColor={primaryColor}
          saving={saving}
          regions={regions}
          regionsLoading={regionsLoading}
          lockedRegionId={lockedRegionId}
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}
      {canManage && modal?.type === "edit" && (() => {
        const director = findCompanyDirector(modal.company);
        const companyRegionId = modal.company.region?.id;
        const resolvedRegionId =
          (typeof companyRegionId === "number" ? companyRegionId : null)
          ?? lockedRegionId
          ?? "";
        let resolvedDistrictId: number | "" = getCompanyDistrictId(modal.company) ?? "";
        if (
          resolvedDistrictId === ""
          && typeof resolvedRegionId === "number"
          && modal.company.district?.name
        ) {
          const found = regions
            .find(r => r.id === resolvedRegionId)
            ?.district.find(d => d.name === modal.company.district?.name);
          if (found) resolvedDistrictId = found.id;
        }
        return (
          <CompanyEditModal
            initial={{
              name: modal.company.name,
              description: modal.company.description,
              address: modal.company.address,
              phone: formatPhoneNumber(modal.company.phone || PHONE_PREFIX),
              active: modal.company.active ?? true,
              region_id: resolvedRegionId,
              district_id: resolvedDistrictId,
              username: director?.username ?? "",
              surname: director?.surname ?? "",
              email: director?.email ?? "",
              password: "",
            }}
            hasDirector={director != null}
            regions={regions}
            regionsLoading={regionsLoading}
            regionLocked={lockedRegionId != null}
            primaryColor={primaryColor}
            saving={saving}
            onSave={handleUpdate}
            onClose={() => setModal(null)}
          />
        );
      })()}
      {canManage && modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Tashkilotni o'chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{modal.company.name}</span>
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
    </main>
  );
}
