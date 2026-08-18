import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, UserPlus, ArrowRight, Loader2, CheckCircle, AlertCircle,
  RefreshCw, ClipboardList, X, Pencil,
} from "lucide-react";
import {
  getPatientsFull,
  getPatientById,
  addPatient,
  updatePatient,
  type Patient,
  type PatientPayload,
} from "@/api/patient";
import { getAllRegions, type Region } from "@/api/region";
import { getStoredUser } from "@/api/session";
import { ApiError } from "@/api/client";

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

type FilterForm = {
  first_name: string;
  last_name: string;
  birth_day: string;
  phone: string;
};

type PatientForm = {
  first_name: string;
  last_name: string;
  birth_day: string;
  phone: string;
  sex: number | "";
  village: string;
  street: string;
  description: string;
  region_id: number | "";
  district_id: number | "";
};

const EMPTY_FILTER: FilterForm = {
  first_name: "",
  last_name: "",
  birth_day: "",
  phone: "",
};

const EMPTY_FORM: PatientForm = {
  first_name: "",
  last_name: "",
  birth_day: "",
  phone: "+998",
  sex: "",
  village: "",
  street: "",
  description: "",
  region_id: "",
  district_id: "",
};

function normalizeBirthDay(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

/** Always starts with +998, then exactly up to 9 digits */
const PHONE_PREFIX = "+998";
const PHONE_PATTERN = /^\+998\d{9}$/;

function formatPhoneNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");

  // Drop leading country code if user typed/pasted 998...
  if (digits.startsWith("998")) digits = digits.slice(3);

  return PHONE_PREFIX + digits.slice(0, 9);
}

function patientToForm(p: Patient, regions: Region[]): PatientForm {
  const districtId = p.district_id ?? p.district?.id ?? "";
  let regionId: number | "" = p.district?.region?.id ?? "";

  if (regionId === "" && districtId !== "") {
    const found = regions.find(r => r.district.some(d => d.id === districtId));
    if (found) regionId = found.id;
  }

  return {
    first_name: p.first_name ?? "",
    last_name: p.last_name ?? "",
    birth_day: normalizeBirthDay(p.birth_day ?? ""),
    phone: formatPhoneNumber(p.phone ?? ""),
    sex: p.sex === 1 || p.sex === 2 ? p.sex : "",
    village: p.village ?? "",
    street: p.street ?? "",
    description: p.description ?? "",
    region_id: regionId,
    district_id: districtId === "" ? "" : Number(districtId),
  };
}

function filterPhoneValue(phone: string): string {
  const formatted = formatPhoneNumber(phone || PHONE_PREFIX);
  return formatted === PHONE_PREFIX ? "" : formatted;
}

function matchesFilter(p: Patient, filter: FilterForm): boolean {
  const fn = filter.first_name.trim().toLowerCase();
  const ln = filter.last_name.trim().toLowerCase();
  const phone = filterPhoneValue(filter.phone).toLowerCase();
  const birth = filter.birth_day.trim();

  if (fn && !(p.first_name ?? "").toLowerCase().includes(fn)) return false;
  if (ln && !(p.last_name ?? "").toLowerCase().includes(ln)) return false;
  if (phone && !(p.phone ?? "").toLowerCase().includes(phone)) return false;
  if (birth && normalizeBirthDay(p.birth_day ?? "") !== birth) return false;
  return true;
}

function buildSearchQuery(filter: FilterForm): string {
  return [
    filterPhoneValue(filter.phone),
    filter.first_name,
    filter.last_name,
    filter.birth_day,
  ]
    .map(v => v.trim())
    .filter(Boolean)
    .join(" ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function PatientsPage({
  primaryColor,
  onGoToOrder,
  initialPatientId = null,
  onInitialPatientConsumed,
}: {
  primaryColor: string;
  onGoToOrder: (patientId: number) => void;
  initialPatientId?: number | null;
  onInitialPatientConsumed?: () => void;
}) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);

  const [filter, setFilter] = useState<FilterForm>({ ...EMPTY_FILTER });
  const [form, setForm] = useState<PatientForm>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Partial<Record<keyof PatientForm, string>>>({});

  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [matches, setMatches] = useState<Patient[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const loadedInitialRef = useRef<number | null>(null);

  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const districts = useMemo(() => {
    if (form.region_id === "") return [];
    return regions.find(r => r.id === form.region_id)?.district ?? [];
  }, [form.region_id, regions]);

  const pushToast = (text: string, type: ToastMsg["type"]) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const loadRegions = async () => {
    setRegionsLoading(true);
    try {
      const data = await getAllRegions();
      setRegions(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Viloyatlarni yuklab bo'lmadi";
      pushToast(msg, "error");
    } finally {
      setRegionsLoading(false);
    }
  };

  useEffect(() => {
    void loadRegions();
  }, []);

  useEffect(() => {
    if (initialPatientId == null) {
      loadedInitialRef.current = null;
      return;
    }
    if (regionsLoading) return;
    if (loadedInitialRef.current === initialPatientId) return;

    let cancelled = false;
    setLoadingInitial(true);

    void (async () => {
      try {
        const patient = await getPatientById(initialPatientId);
        if (cancelled) return;
        loadedInitialRef.current = initialPatientId;
        setSelectedPatientId(patient.id);
        setForm(patientToForm(patient, regions));
        setErrors({});
        setMatches([]);
        setSearched(false);
        pushToast("Bemor ma'lumotlari yuklandi", "success");
        onInitialPatientConsumed?.();
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : "Bemorni yuklab bo'lmadi";
        pushToast(msg, "error");
        onInitialPatientConsumed?.();
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when navigating from kassa edit
  }, [initialPatientId, regionsLoading, regions]);

  const setFilterField = <K extends keyof FilterForm>(k: K, v: FilterForm[K]) => {
    setFilter(f => ({ ...f, [k]: v }));
  };

  const setFormField = <K extends keyof PatientForm>(k: K, v: PatientForm[K]) => {
    setForm(f => {
      const next = { ...f, [k]: v };
      if (k === "region_id") next.district_id = "";
      return next;
    });
    setErrors(e => ({ ...e, [k]: undefined }));
    if (selectedPatientId != null && k !== "description") {
      // Editing after load means we treat as potentially new/changed data;
      // keep selected id until explicit clear — still allow order with existing id.
    }
  };

  const applyPatient = (p: Patient) => {
    setSelectedPatientId(p.id);
    setForm(patientToForm(p, regions));
    setErrors({});
  };

  const clearSelection = () => {
    setSelectedPatientId(null);
    setMatches([]);
    setSearched(false);
  };

  const handleSearch = async () => {
    const hasAny =
      Boolean(filter.first_name.trim()) ||
      Boolean(filter.last_name.trim()) ||
      Boolean(filter.birth_day.trim()) ||
      Boolean(filterPhoneValue(filter.phone));
    if (!hasAny) {
      pushToast("Qidiruv uchun kamida bitta maydonni to'ldiring", "info");
      return;
    }

    setSearching(true);
    setSearched(true);
    setMatches([]);
    try {
      const search = buildSearchQuery(filter);
      const res = await getPatientsFull({ page: 1, limit: 50, search });
      const found = res.data.filter(p => matchesFilter(p, filter));

      if (found.length === 0) {
        setSelectedPatientId(null);
        setForm({
          ...EMPTY_FORM,
          first_name: filter.first_name,
          last_name: filter.last_name,
          birth_day: filter.birth_day,
          phone: formatPhoneNumber(filter.phone || PHONE_PREFIX),
        });
        pushToast("Bemor topilmadi. Ma'lumotlarni qo'lda to'ldiring", "info");
        return;
      }

      if (found.length === 1) {
        applyPatient(found[0]);
        setMatches([]);
        pushToast("Bemor topildi", "success");
        return;
      }

      setMatches(found);
      setSelectedPatientId(null);
      pushToast(`${found.length} ta bemor topildi — tanlang`, "info");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Qidiruv muvaffaqiyatsiz";
      pushToast(msg, "error");
    } finally {
      setSearching(false);
    }
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof PatientForm, string>> = {};
    if (!form.first_name.trim()) e.first_name = "Ism kiritilishi shart";
    if (!form.last_name.trim()) e.last_name = "Familiya kiritilishi shart";
    if (!form.birth_day) e.birth_day = "Tug'ilgan kun kiritilishi shart";
    const phone = formatPhoneNumber(form.phone);
    if (phone === PHONE_PREFIX) {
      e.phone = "Telefon kiritilishi shart";
    } else if (!PHONE_PATTERN.test(phone)) {
      e.phone = "Format: +998 dan keyin 9 ta raqam (masalan: +998901234567)";
    }
    if (form.sex !== 1 && form.sex !== 2) e.sex = "Jinsni tanlang";
    if (!form.village.trim()) e.village = "MFY / qishloq kiritilishi shart";
    if (!form.street.trim()) e.street = "Ko'cha / manzil kiritilishi shart";
    if (form.region_id === "") e.region_id = "Viloyatni tanlang";
    if (form.district_id === "") e.district_id = "Tumanni tanlang";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const toPayload = (): PatientPayload => {
    const user = getStoredUser();
    if (!user?.id) {
      throw new ApiError("Foydalanuvchi sessiyasi topilmadi. Qayta kiring", 401);
    }
    return {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      birth_day: form.birth_day,
      phone: formatPhoneNumber(form.phone),
      sex: Number(form.sex),
      village: form.village.trim(),
      street: form.street.trim(),
      description: form.description.trim(),
      district_id: Number(form.district_id),
      owner_id: user.id,
    };
  };

  const handleUpdatePatient = async () => {
    if (selectedPatientId == null) return;
    if (!validate()) {
      pushToast("Barcha majburiy maydonlarni to'ldiring", "error");
      return;
    }

    setUpdating(true);
    try {
      await updatePatient(selectedPatientId, toPayload());
      pushToast("Bemor ma'lumotlari yangilandi", "success");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Bemorni yangilab bo'lmadi";
      pushToast(msg, "error");
    } finally {
      setUpdating(false);
    }
  };

  const handleGoToOrder = async () => {
    if (!validate()) {
      pushToast("Barcha majburiy maydonlarni to'ldiring", "error");
      return;
    }

    if (selectedPatientId != null) {
      onGoToOrder(selectedPatientId);
      return;
    }

    setSaving(true);
    try {
      const created = await addPatient(toPayload());
      const id = created?.id;
      if (!id) throw new ApiError("Yaratilgan bemor ID si topilmadi", 500);
      setSelectedPatientId(id);
      pushToast("Bemor ro'yxatga olindi", "success");
      onGoToOrder(id);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Bemorni saqlab bo'lmadi";
      pushToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (err?: string) =>
    `w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none transition-all ${
      err ? "border-red-400 focus:border-red-500" : "border-border focus:border-[var(--primary)]"
    }`;

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
      {/* Toasts */}
      <div className="fixed top-20 right-6 z-[60] space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg bg-card animate-fade-in min-w-[260px]"
            style={{
              borderColor:
                t.type === "success" ? "#86efac" : t.type === "error" ? "#fca5a5" : "#93c5fd",
            }}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : t.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <Search className="w-4 h-4 text-teal-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Filter section */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${primaryColor}18` }}
            >
              <Search className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">Bemor qidirish</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mavjud bemorni topish uchun filterlardan foydalaning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setFilter({ ...EMPTY_FILTER });
              setForm({ ...EMPTY_FORM });
              clearSelection();
            }}
            className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tozalash
          </button>
        </div>

        <form
          className="p-5"
          onSubmit={e => {
            e.preventDefault();
            void handleSearch();
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
            <Field label="Familiya">
              <input
                type="text"
                value={filter.last_name}
                placeholder="Familya"
                onChange={e => setFilterField("last_name", e.target.value)}
                className={inputCls()}
              />
            </Field>
            <Field label="Ism">
              <input
                type="text"
                value={filter.first_name}
                placeholder="Ism"
                onChange={e => setFilterField("first_name", e.target.value)}
                className={inputCls()}
              />
            </Field>
            <Field label="Tug'ilgan kun">
              <input
                type="date"
                value={filter.birth_day}
                onChange={e => setFilterField("birth_day", e.target.value)}
                className={inputCls()}
              />
            </Field>
            <Field label="Telefon">
              <input
                type="tel"
                value={filter.phone || PHONE_PREFIX}
                placeholder="+998901234567"
                maxLength={13}
                inputMode="numeric"
                autoComplete="tel"
                onChange={e => setFilterField("phone", formatPhoneNumber(e.target.value))}
                onFocus={e => {
                  if (!filter.phone || filter.phone === PHONE_PREFIX) {
                    setFilterField("phone", PHONE_PREFIX);
                  }
                  requestAnimationFrame(() => {
                    const el = e.target;
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
                className={inputCls()}
              />
            </Field>
            <button
              type="submit"
              disabled={searching}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              style={{ background: primaryColor }}
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Qidirish
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">

            {selectedPatientId != null && (
              <span
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: `${primaryColor}15`, color: primaryColor }}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Tanlangan bemor ID: {selectedPatientId}
              </span>
            )}

            {searched && selectedPatientId == null && matches.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400">
                <UserPlus className="w-3.5 h-3.5" />
                Yangi bemor — pastdagi formani to'ldiring
              </span>
            )}
          </div>

          {matches.length > 1 && (
            <div className="mt-4 border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-secondary/60 border-b border-border text-xs font-semibold text-muted-foreground">
                Natijalar — bemorni tanlang
              </div>
              <div className="divide-y divide-border max-h-48 overflow-y-auto ses-scrollbar">
                {matches.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      applyPatient(p);
                      setMatches([]);
                      pushToast("Bemor tanlandi", "success");
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-secondary/50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground truncate">
                        {p.last_name} {p.first_name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {p.phone} · {normalizeBirthDay(p.birth_day)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </section>

      {/* Patient form section */}
      <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${primaryColor}18` }}
            >
              <ClipboardList className="w-4 h-4" style={{ color: primaryColor }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-foreground">
                {loadingInitial
                  ? "Bemor yuklanmoqda..."
                  : selectedPatientId != null
                    ? "Bemor ma'lumotlari"
                    : "Yangi bemor ma'lumotlari"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loadingInitial
                  ? "Kassa dan tanlangan bemor formaga joylanmoqda"
                  : selectedPatientId != null
                    ? "Topilgan bemor — buyurtma yaratishga o'tishingiz mumkin"
                    : "Ma'lumotlarni to'ldiring, keyin buyurtma sahifasiga o'ting (bemor avtomatik yaratiladi)"}
              </p>
            </div>
          </div>
          {selectedPatientId != null && (
            <button
              type="button"
              onClick={() => {
                setSelectedPatientId(null);
                setForm({ ...EMPTY_FORM });
              }}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground"
              title="Tanlovni bekor qilish"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Familiya *" error={errors.last_name}>
              <input
                type="text"
                value={form.last_name}
                placeholder="Familya"
                onChange={e => setFormField("last_name", e.target.value)}
                className={inputCls(errors.last_name)}
              />
            </Field>
            <Field label="Ism *" error={errors.first_name}>
              <input
                type="text"
                value={form.first_name}
                placeholder="Ism"
                onChange={e => setFormField("first_name", e.target.value)}
                className={inputCls(errors.first_name)}
              />
            </Field>
            <Field label="Tug'ilgan kun *" error={errors.birth_day}>
              <input
                type="date"
                value={form.birth_day}
                onChange={e => setFormField("birth_day", e.target.value)}
                className={inputCls(errors.birth_day)}
              />
            </Field>
            <Field label="Telefon *" error={errors.phone}>
              <input
                type="tel"
                value={form.phone || PHONE_PREFIX}
                placeholder="+998901234567"
                maxLength={13}
                inputMode="numeric"
                autoComplete="tel"
                onChange={e => setFormField("phone", formatPhoneNumber(e.target.value))}
                onFocus={e => {
                  if (!form.phone || form.phone === PHONE_PREFIX) {
                    setFormField("phone", PHONE_PREFIX);
                  }
                  requestAnimationFrame(() => {
                    const el = e.target;
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
            </Field>
            <Field label="Jins *" error={errors.sex}>
              <div
                className={`flex gap-2 ${errors.sex ? "rounded-xl ring-1 ring-red-400" : ""}`}
                role="radiogroup"
                aria-label="Jins"
              >
                {(
                  [
                    { value: 1, label: "Erkak" },
                    { value: 2, label: "Ayol" },
                  ] as const
                ).map(opt => {
                  const selected = form.sex === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-[13px] font-medium cursor-pointer transition-all select-none ${
                        selected
                          ? "border-[var(--primary)] text-[var(--primary)]"
                          : "border-border bg-secondary text-foreground hover:border-[var(--primary)]/40"
                      }`}
                      style={
                        selected
                          ? { background: `${primaryColor}15` }
                          : undefined
                      }
                    >
                      <span
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? "border-[var(--primary)]" : "border-muted-foreground/40"
                        }`}
                      >
                        {selected && (
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: primaryColor }}
                          />
                        )}
                      </span>
                      <input
                        type="radio"
                        name="patient-sex"
                        value={opt.value}
                        checked={selected}
                        onChange={() => setFormField("sex", opt.value)}
                        className="sr-only"
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Viloyat *" error={errors.region_id}>
              <select
                value={form.region_id === "" ? "" : String(form.region_id)}
                onChange={e =>
                  setFormField("region_id", e.target.value ? Number(e.target.value) : "")
                }
                disabled={regionsLoading}
                className={inputCls(errors.region_id)}
              >
                <option value="">{regionsLoading ? "Yuklanmoqda..." : "Viloyat tanlang"}</option>
                {regions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Tuman *" error={errors.district_id}>
              <select
                value={form.district_id === "" ? "" : String(form.district_id)}
                onChange={e =>
                  setFormField("district_id", e.target.value ? Number(e.target.value) : "")
                }
                disabled={form.region_id === ""}
                className={inputCls(errors.district_id)}
              >
                <option value="">
                  {form.region_id === "" ? "Avval viloyat tanlang" : "Tuman tanlang"}
                </option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            <Field label="MFY / Qishloq *" error={errors.village}>
              <input
                type="text"
                value={form.village}
                placeholder="MFY / Qishloq"
                onChange={e => setFormField("village", e.target.value)}
                className={inputCls(errors.village)}
              />
            </Field>
            <Field label="Ko'cha / Manzil *" error={errors.street}>
              <input
                type="text"
                value={form.street}
                placeholder="Ko'cha / Manzil"
                onChange={e => setFormField("street", e.target.value)}
                className={inputCls(errors.street)}
              />
            </Field>
          </div>

          <Field label="Izoh">
            <textarea
              value={form.description}
              placeholder="Qo'shimcha ma'lumot..."
              rows={3}
              onChange={e => setFormField("description", e.target.value)}
              className={`${inputCls()} resize-none`}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => void handleUpdatePatient()}
              disabled={selectedPatientId == null || updating || saving}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border border-border text-foreground transition-all hover:bg-secondary active:scale-[0.98] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:active:scale-100"
            >
              {updating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Tahrirlash
            </button>
            <button
              type="button"
              onClick={() => void handleGoToOrder()}
              disabled={saving || updating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
              style={{ background: primaryColor }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {selectedPatientId != null
                ? "Kassaga o'tish"
                : "Saqlash va kassaga o'tish"}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
