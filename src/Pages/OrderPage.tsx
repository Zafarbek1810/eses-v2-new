import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Plus, X, CheckCircle,
  FlaskConical, MessageSquare, Search, UserPlus, ClipboardList, Pencil,
  RefreshCw, QrCode,
} from "lucide-react";
import { getPatientById, getPatientsFull, type Patient } from "@/api/patient";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { getAllAnalyses, type Analysis } from "@/api/analysis";
import { addOrder, updateOrder, updatePaymentStatus, type PaymentMethod } from "@/api/order";
import { getStoredCompanyId, getStoredUser } from "@/api/session";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import { statusLabel } from "@/lib/orderStatus";
import { fetchPdfTemplatesFromApi } from "@/lib/pdfTemplate";
import { ReceiptModal, buildReceiptQrLinks, type ResultQrLink } from "@/components/ReceiptModal";

type PatientFilterForm = {
  first_name: string;
  last_name: string;
  birth_day: string;
  phone: string;
};

const EMPTY_PATIENT_FILTER: PatientFilterForm = {
  first_name: "",
  last_name: "",
  birth_day: "",
  phone: "",
};

const PHONE_PREFIX = "+998";

function normalizeBirthDay(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function formatPhoneNumber(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("998")) digits = digits.slice(3);
  return PHONE_PREFIX + digits.slice(0, 9);
}

function filterPhoneValue(phone: string): string {
  const formatted = formatPhoneNumber(phone || PHONE_PREFIX);
  return formatted === PHONE_PREFIX ? "" : formatted;
}

function matchesPatientFilter(p: Patient, filter: PatientFilterForm): boolean {
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

function buildPatientSearchQuery(filter: PatientFilterForm): string {
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

function hasPatientFilter(filter: PatientFilterForm): boolean {
  return (
    Boolean(filter.first_name.trim()) ||
    Boolean(filter.last_name.trim()) ||
    Boolean(filter.birth_day.trim()) ||
    Boolean(filterPhoneValue(filter.phone))
  );
}

function formatBirthDay(value: string | undefined): string {
  if (!value) return "—";
  const d = value.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

function sexLabel(sex: number | undefined): string {
  if (sex === 1) return "Erkak";
  if (sex === 2) return "Ayol";
  return "—";
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-foreground mb-1.5">{label}</label>
      {children}
    </div>
  );
}

type ToastMsg = { id: number; text: string; type: "success" | "error" | "info" };

type CartItem = {
  key: string;
  analysis_id: number;
  laboratory_id: number;
  analysis_name: string;
  laboratory_name: string;
  price: number;
  status: "pending";
};

function extractCreatedOrderId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nested =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>).id
      : undefined;
  const n = Number(obj.id ?? nested);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" },
  { value: "card", label: "Karta" },
  { value: "click", label: "Click" },
];

function formatPrice(price: number) {
  return price.toLocaleString("uz-UZ") + " so'm";
}

function parsePrice(raw: string | number | undefined): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}

type PickedAnalysis = Omit<CartItem, "key" | "status">;

function itemKey(laboratoryId: number, analysisId: number) {
  return `${laboratoryId}:${analysisId}`;
}

function AnalysisPickModal({
  laboratories,
  analyses,
  primaryColor,
  existingKeys,
  onSave,
  onClose,
}: {
  laboratories: Laboratory[];
  analyses: Analysis[];
  primaryColor: string;
  existingKeys: Set<string>;
  onSave: (items: PickedAnalysis[]) => void;
  onClose: () => void;
}) {
  const [labId, setLabId] = useState<number | null>(
    laboratories[0]?.id ?? null,
  );
  const [picked, setPicked] = useState<PickedAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pickedKeys = useMemo(
    () => new Set(picked.map(p => itemKey(p.laboratory_id, p.analysis_id))),
    [picked],
  );

  const labAnalyses = useMemo(() => {
    if (labId == null) return [];
    return analyses.filter(a => a.laboratory?.id === labId);
  }, [analyses, labId]);

  const availableAnalyses = useMemo(
    () =>
      labAnalyses.filter(
        a => labId != null && !existingKeys.has(itemKey(labId, a.id)),
      ),
    [labAnalyses, labId, existingKeys],
  );

  const selectedInCurrentLab = useMemo(
    () =>
      labId == null
        ? 0
        : availableAnalyses.filter(a =>
            pickedKeys.has(itemKey(labId, a.id)),
          ).length,
    [availableAnalyses, labId, pickedKeys],
  );

  const selectedTotal = useMemo(
    () => picked.reduce((sum, a) => sum + a.price, 0),
    [picked],
  );

  const analysisCountByLab = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of analyses) {
      const id = a.laboratory?.id;
      if (id == null) continue;
      if (existingKeys.has(itemKey(id, a.id))) continue;
      map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [analyses, existingKeys]);

  const pickedCountByLab = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of picked) {
      map.set(p.laboratory_id, (map.get(p.laboratory_id) ?? 0) + 1);
    }
    return map;
  }, [picked]);

  const toggleAnalysis = (analysis: Analysis) => {
    if (labId == null) return;
    const key = itemKey(labId, analysis.id);
    setPicked(prev => {
      if (prev.some(p => itemKey(p.laboratory_id, p.analysis_id) === key)) {
        return prev.filter(
          p => itemKey(p.laboratory_id, p.analysis_id) !== key,
        );
      }
      const lab = laboratories.find(l => l.id === labId);
      return [
        ...prev,
        {
          analysis_id: analysis.id,
          laboratory_id: labId,
          analysis_name: analysis.name,
          laboratory_name: lab?.name ?? analysis.laboratory?.name ?? "—",
          price: parsePrice(analysis.price),
        },
      ];
    });
    setError(null);
  };

  const toggleAllInLab = () => {
    if (labId == null || availableAnalyses.length === 0) return;
    const lab = laboratories.find(l => l.id === labId);
    const allSelected = selectedInCurrentLab === availableAnalyses.length;

    setPicked(prev => {
      if (allSelected) {
        const removeKeys = new Set(
          availableAnalyses.map(a => itemKey(labId, a.id)),
        );
        return prev.filter(
          p => !removeKeys.has(itemKey(p.laboratory_id, p.analysis_id)),
        );
      }
      const existing = new Set(
        prev.map(p => itemKey(p.laboratory_id, p.analysis_id)),
      );
      const toAdd = availableAnalyses
        .filter(a => !existing.has(itemKey(labId, a.id)))
        .map(a => ({
          analysis_id: a.id,
          laboratory_id: labId,
          analysis_name: a.name,
          laboratory_name: lab?.name ?? a.laboratory?.name ?? "—",
          price: parsePrice(a.price),
        }));
      return [...prev, ...toAdd];
    });
    setError(null);
  };

  const removePicked = (laboratoryId: number, analysisId: number) => {
    const key = itemKey(laboratoryId, analysisId);
    setPicked(prev =>
      prev.filter(p => itemKey(p.laboratory_id, p.analysis_id) !== key),
    );
    setError(null);
  };

  const clearPicked = () => {
    setPicked([]);
    setError(null);
  };

  const handleSave = () => {
    if (picked.length === 0) {
      setError("Kamida bitta analizni tanlang");
      return;
    }
    onSave(picked);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-6xl h-[min(860px,92vh)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[16px]">Analiz qo'shish</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Laboratoriya tanlang, analizlarni belgilang — bir nechta laboratoriyadan yig'ish mumkin
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_280px] divide-y md:divide-y-0 md:divide-x divide-border">
          {/* 1 — Laboratoriyalar */}
          <div className="flex flex-col min-h-0 max-h-[220px] md:max-h-none">
            <div className="px-4 py-3 border-b border-border shrink-0">
              <p className="text-xs font-semibold text-foreground">Laboratoriyalar</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {laboratories.length} ta
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {laboratories.length === 0 ? (
                <p className="px-3 py-4 text-[13px] text-muted-foreground">
                  Laboratoriya topilmadi
                </p>
              ) : (
                laboratories.map(lab => {
                  const active = labId === lab.id;
                  const avail = analysisCountByLab.get(lab.id) ?? 0;
                  const selectedHere = pickedCountByLab.get(lab.id) ?? 0;
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => {
                        setLabId(lab.id);
                        setError(null);
                      }}
                      className={[
                        "w-full text-left rounded-xl px-3 py-2.5 transition-colors",
                        active
                          ? "bg-secondary border border-border"
                          : "hover:bg-secondary/70 border border-transparent",
                      ].join(" ")}
                      style={
                        active
                          ? { boxShadow: `inset 3px 0 0 ${primaryColor}` }
                          : undefined
                      }
                    >
                      <span className="block text-[13px] font-medium text-foreground truncate">
                        {lab.name}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{avail} ta analiz</span>
                        {selectedHere > 0 && (
                          <span
                            className="font-semibold"
                            style={{ color: primaryColor }}
                          >
                            · {selectedHere} tanlangan
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 2 — Analizlar (checkbox) */}
          <div className="flex flex-col min-h-[240px] md:min-h-0">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">Analizlar</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {labId == null
                    ? "Avval laboratoriya tanlang"
                    : laboratories.find(l => l.id === labId)?.name ?? "—"}
                </p>
              </div>
              {labId != null && availableAnalyses.length > 0 && (
                <button
                  type="button"
                  onClick={toggleAllInLab}
                  className="text-[11px] font-medium hover:underline shrink-0"
                  style={{ color: primaryColor }}
                >
                  {selectedInCurrentLab === availableAnalyses.length
                    ? "Barchasini bekor qilish"
                    : "Barchasini tanlash"}
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {labId == null ? (
                <p className="px-4 py-8 text-[13px] text-muted-foreground text-center">
                  Chapdan laboratoriya tanlang
                </p>
              ) : availableAnalyses.length === 0 ? (
                <p className="px-4 py-8 text-[13px] text-amber-600 text-center">
                  {labAnalyses.length === 0
                    ? "Bu laboratoriyada analiz topilmadi"
                    : "Barcha analizlar allaqachon qo'shilgan"}
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {availableAnalyses.map(a => {
                    const checked = pickedKeys.has(itemKey(labId, a.id));
                    return (
                      <label
                        key={a.id}
                        className={[
                          "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none",
                          checked ? "bg-secondary/50" : "hover:bg-secondary/40",
                        ].join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAnalysis(a)}
                          className="w-4 h-4 rounded border-border accent-[var(--primary)] shrink-0"
                        />
                        <span className="flex-1 min-w-0 text-[13px] text-foreground">
                          {a.name}
                        </span>
                        <span className="text-[12px] text-muted-foreground shrink-0 tabular-nums">
                          {formatPrice(parsePrice(a.price))}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 3 — Tanlanganlar yig'indisi */}
          <div className="flex flex-col min-h-0 max-h-[260px] md:max-h-none bg-secondary/20">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-foreground">Tanlanganlar</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {picked.length} ta · {formatPrice(selectedTotal)}
                </p>
              </div>
              {picked.length > 0 && (
                <button
                  type="button"
                  onClick={clearPicked}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground hover:underline shrink-0"
                >
                  Tozalash
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {picked.length === 0 ? (
                <p className="px-2 py-8 text-[13px] text-muted-foreground text-center">
                  Tanlangan analizlar shu yerda yig'iladi
                </p>
              ) : (
                picked.map(p => (
                  <div
                    key={itemKey(p.laboratory_id, p.analysis_id)}
                    className="rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-foreground leading-snug">
                          {p.analysis_name}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {p.laboratory_name}
                        </p>
                        <p className="text-[12px] text-muted-foreground mt-1 tabular-nums">
                          {formatPrice(p.price)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          removePicked(p.laboratory_id, p.analysis_id)
                        }
                        className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
                        aria-label="O'chirish"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          {error && <p className="text-[12px] text-red-500 sm:mr-auto">{error}</p>}
          {!error && (
            <p className="text-[12px] text-muted-foreground sm:mr-auto">
              Jami:{" "}
              <span className="font-semibold text-foreground">
                {formatPrice(selectedTotal)}
              </span>
            </p>
          )}
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none sm:min-w-[120px] py-2.5 px-4 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none sm:min-w-[160px] py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: primaryColor }}
            >
              {picked.length > 0
                ? `${picked.length} ta qo'shish`
                : "Saqlash"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  primaryColor,
  initialMethod,
  initialAmount,
  onConfirm,
  onClose,
}: {
  primaryColor: string;
  initialMethod: PaymentMethod | null;
  initialAmount: number;
  onConfirm: (method: PaymentMethod, amount: number) => void;
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | "">(initialMethod ?? "");
  const [amount, setAmount] = useState(
    initialAmount > 0 ? String(Math.round(initialAmount)) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    "w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]";

  const handlePay = () => {
    if (!method) {
      setError("To'lov turini tanlang");
      return;
    }
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) {
      setError("To'g'ri summa kiriting");
      return;
    }
    onConfirm(method, n);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">To&apos;lov qilish</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              To&apos;lov turi va summani kiriting
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              To&apos;lov turi *
            </label>
            <select
              value={method}
              onChange={e => {
                setMethod(e.target.value as PaymentMethod | "");
                setError(null);
              }}
              className={inputCls}
            >
              <option value="">Tanlang</option>
              {PAYMENT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Summa *
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={e => {
                setAmount(e.target.value);
                setError(null);
              }}
              placeholder="0"
              className={inputCls}
            />
            {initialAmount > 0 && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Hisoblangan summa: {formatPrice(initialAmount)}
              </p>
            )}
          </div>

          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={handlePay}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            To&apos;lov qilish
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderPage({
  primaryColor,
  patientId,
  onPatientChange,
  onEditPatient,
}: {
  primaryColor: string;
  patientId: number | null;
  onPatientChange: (patientId: number | null) => void;
  onEditPatient?: (patientId: number) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [patientFilter, setPatientFilter] = useState<PatientFilterForm>({ ...EMPTY_PATIENT_FILTER });
  const [patientMatches, setPatientMatches] = useState<Patient[]>([]);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [patientSearched, setPatientSearched] = useState(false);

  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [refsLoading, setRefsLoading] = useState(true);

  const [items, setItems] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptLinks, setReceiptLinks] = useState<ResultQrLink[]>([]);
  const [paymentPaid, setPaymentPaid] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const createdOrderIdRef = useRef<number | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [removeTargetKey, setRemoveTargetKey] = useState<string | null>(null);

  const pushToast = (text: string, type: ToastMsg["type"]) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };

  const resetOrderForm = () => {
    setItems([]);
    setPaymentMethod(null);
    setPaymentPickerOpen(false);
    setDiscountPercent("");
    setSendSms(true);
    setAnalysisModalOpen(false);
    setPaymentModalOpen(false);
    setReceiptOpen(false);
    setReceiptLoading(false);
    setReceiptLinks([]);
    setPaymentPaid(false);
    setPaidAmount(0);
    createdOrderIdRef.current = null;
  };

  useEffect(() => {
    if (patientId == null) {
      setPatient(null);
      setLoading(false);
      setError(null);
      resetOrderForm();
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      resetOrderForm();
      try {
        const data = await getPatientById(patientId);
        if (!cancelled) setPatient(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Bemorni yuklab bo'lmadi");
          setPatient(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRefsLoading(true);
      try {
        const [labs, ans] = await Promise.all([
          getAllLaboratories(),
          getAllAnalyses(),
        ]);
        if (!cancelled) {
          setLaboratories(Array.isArray(labs) ? labs : []);
          setAnalyses(Array.isArray(ans) ? ans : []);
        }
      } catch (err) {
        if (!cancelled) {
          pushToast(
            err instanceof ApiError ? err.message : "Ma'lumotlarni yuklab bo'lmadi",
            "error",
          );
        }
      } finally {
        if (!cancelled) setRefsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const setPatientFilterField = <K extends keyof PatientFilterForm>(
    k: K,
    v: PatientFilterForm[K],
  ) => {
    setPatientFilter(f => ({ ...f, [k]: v }));
  };

  const loadPatients = async (filter: PatientFilterForm = patientFilter) => {
    setSearchingPatients(true);
    setPatientSearched(true);
    try {
      const search = buildPatientSearchQuery(filter);
      const res = await getPatientsFull({
        page: 1,
        limit: 50,
        ...(search ? { search } : {}),
      });
      const found = hasPatientFilter(filter)
        ? res.data.filter(p => matchesPatientFilter(p, filter))
        : res.data;
      setPatientMatches(found);
      if (search && found.length === 0) pushToast("Bemor topilmadi", "info");
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Bemorlarni yuklab bo'lmadi", "error");
      setPatientMatches([]);
    } finally {
      setSearchingPatients(false);
    }
  };

  const handleSearchPatients = async () => {
    await loadPatients(patientFilter);
  };

  const clearPatientFilter = () => {
    const empty = { ...EMPTY_PATIENT_FILTER };
    setPatientFilter(empty);
    void loadPatients(empty);
  };

  useEffect(() => {
    if (patientId != null) return;
    void loadPatients(EMPTY_PATIENT_FILTER);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial list when opening kassa without patient
  }, [patientId]);

  const clearPatient = () => {
    onPatientChange(null);
    setPatientFilter({ ...EMPTY_PATIENT_FILTER });
  };

  const existingKeys = useMemo(
    () => new Set(items.map(i => `${i.laboratory_id}:${i.analysis_id}`)),
    [items],
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.price, 0),
    [items],
  );

  const parsedDiscount = useMemo(() => {
    const raw = discountPercent.trim();
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
  }, [discountPercent]);

  const amountDue = useMemo(() => {
    if (parsedDiscount == null) return totalPrice;
    return Math.max(0, Math.round(totalPrice * (1 - parsedDiscount / 100)));
  }, [totalPrice, parsedDiscount]);

  const paymentLabel =
    PAYMENT_OPTIONS.find(o => o.value === paymentMethod)?.label ?? null;

  const handleAddAnalysis = (newItems: Omit<CartItem, "key" | "status">[]) => {
    if (newItems.length === 0) return;
    setItems(list => [
      ...list,
      ...newItems.map(item => ({
        ...item,
        key: `${item.laboratory_id}:${item.analysis_id}`,
        status: "pending" as const,
      })),
    ]);
    setAnalysisModalOpen(false);
    setPaymentPaid(false);
    pushToast(
      newItems.length === 1
        ? "Analiz qo'shildi"
        : `${newItems.length} ta analiz qo'shildi`,
      "success",
    );
  };

  const handleRemoveItem = (key: string) => {
    setItems(list => list.filter(i => i.key !== key));
    setPaymentPaid(false);
    setRemoveTargetKey(null);
  };

  const removeTarget = removeTargetKey
    ? items.find(i => i.key === removeTargetKey) ?? null
    : null;

  const openPaymentModal = () => {
    if (items.length === 0) {
      pushToast("Avval analiz qo'shing", "info");
      return;
    }
    setPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (method: PaymentMethod, amount: number) => {
    setPaymentMethod(method);
    setPaidAmount(amount);
    setPaymentPaid(true);
    setPaymentModalOpen(false);
    pushToast("To'lov qabul qilindi", "success");
  };

  const persistOrder = async (): Promise<number | null> => {
    if (createdOrderIdRef.current) return createdOrderIdRef.current;
    if (!patient) return null;
    if (items.length === 0) {
      pushToast("Kamida bitta analiz qo'shing", "info");
      return null;
    }
    if (!paymentMethod) {
      pushToast("To'lov turini tanlang", "info");
      return null;
    }

    let discountValue: number | null = null;
    const discountRaw = discountPercent.trim();
    if (discountRaw !== "") {
      const n = Number(discountRaw);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        pushToast("Chegirma 0 dan 100 gacha bo'lishi kerak", "info");
        return null;
      }
      discountValue = n;
    }

    const user = getStoredUser();
    if (!user?.id) {
      pushToast("Foydalanuvchi sessiyasi topilmadi. Qayta kiring", "error");
      return null;
    }

    const created = await addOrder({
      order_type: "patient",
      payment_method: paymentMethod,
      discount_percent: discountValue,
      street: patient.street || null,
      village: patient.village || null,
      description: patient.description || null,
      district_id: patient.district_id ?? patient.district?.id ?? null,
      patient_id: patient.id,
      owner_id: user.id,
      items: items.map(i => ({
        analysis_id: i.analysis_id,
        laboratory_id: i.laboratory_id,
        price: i.price,
      })),
    });

    const id = extractCreatedOrderId(created);
    if (id == null) {
      pushToast("Order yaratildi, lekin ID qaytmadi", "error");
      return null;
    }

    createdOrderIdRef.current = id;

    if (paymentPaid) {
      try {
        await updatePaymentStatus(id, "paid");
      } catch {
        pushToast("Order yaratildi, lekin to'lov holatini yangilab bo'lmadi", "info");
      }

      if (sendSms) {
        try {
          await updateOrder(id, { payment_sms: true });
        } catch {
          pushToast("Order yaratildi, lekin to'lov SMS yuborib bo'lmadi", "info");
        }
      }
    }

    return id;
  };

  const openReceipt = async () => {
    if (receiptLoading) return;
    setReceiptLoading(true);
    try {
      const orderId = await persistOrder();
      if (orderId == null) return;

      const templates = await fetchPdfTemplatesFromApi(getStoredCompanyId() ?? undefined).catch(() => []);
      setReceiptLinks(buildReceiptQrLinks(orderId, items, templates));
      setReceiptOpen(true);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Chek ochib bo'lmadi", "error");
    } finally {
      setReceiptLoading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const created = await persistOrder();
      if (created == null) return;
      pushToast(
        paymentPaid && sendSms
          ? "Order yaratildi. To'lov SMS yuborildi"
          : paymentPaid
            ? "Order yaratildi. To'lov holati: To'langan"
            : "Order muvaffaqiyatli yaratildi",
        "success",
      );
      setTimeout(() => clearPatient(), 900);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Order yaratib bo'lmadi", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 space-y-5 ses-scrollbar">
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
              <FlaskConical className="w-4 h-4 text-teal-500 shrink-0" />
            )}
            <span className="text-[13px] text-foreground">{t.text}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">Kassa</h2>
          <p className="text-xs text-muted-foreground">
            Bemor uchun analizlar va to&apos;lovni rasmiylashtirish
          </p>
        </div>
        {patientId != null && (
          <button
            type="button"
            onClick={clearPatient}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Boshqa bemor
          </button>
        )}
      </div>

      {patientId == null ? (
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${primaryColor}18` }}
              >
                <Search className="w-4 h-4" style={{ color: primaryColor }} />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">Bemorlar ro&apos;yxati</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filter orqali bemorni toping yoki jadvaldan tanlang
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearPatientFilter}
              className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tozalash
            </button>
          </div>

          <form
            className="p-5 space-y-4"
            onSubmit={e => {
              e.preventDefault();
              void handleSearchPatients();
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <FilterField label="Familiya">
                <input
                  type="text"
                  value={patientFilter.last_name}
                  placeholder="Familya"
                  onChange={e => setPatientFilterField("last_name", e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </FilterField>
              <FilterField label="Ism">
                <input
                  type="text"
                  value={patientFilter.first_name}
                  placeholder="Ism"
                  onChange={e => setPatientFilterField("first_name", e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </FilterField>
              <FilterField label="Tug'ilgan kun">
                <input
                  type="date"
                  value={patientFilter.birth_day}
                  onChange={e => setPatientFilterField("birth_day", e.target.value)}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </FilterField>
              <FilterField label="Telefon">
                <input
                  type="tel"
                  value={patientFilter.phone || PHONE_PREFIX}
                  placeholder="+998901234567"
                  maxLength={13}
                  inputMode="numeric"
                  autoComplete="tel"
                  onChange={e => setPatientFilterField("phone", formatPhoneNumber(e.target.value))}
                  onFocus={e => {
                    if (!patientFilter.phone || patientFilter.phone === PHONE_PREFIX) {
                      setPatientFilterField("phone", PHONE_PREFIX);
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
                      start < PHONE_PREFIX.length ||
                      (start === end && start <= PHONE_PREFIX.length && e.key === "Backspace");
                    if (
                      (e.key === "Backspace" || e.key === "Delete") &&
                      touchingPrefix &&
                      end <= PHONE_PREFIX.length
                    ) {
                      e.preventDefault();
                      input.setSelectionRange(PHONE_PREFIX.length, PHONE_PREFIX.length);
                    }
                  }}
                  className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)] transition-all"
                />
              </FilterField>
              <button
                type="submit"
                disabled={searchingPatients}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-70"
                style={{ background: primaryColor }}
              >
                {searchingPatients ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Qidirish
              </button>
            </div>
          </form>

          <div className="overflow-x-auto ses-scrollbar border-t border-border">
            <table className="w-full min-w-[1000px] text-left">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    ID
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Bemor
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Telefon
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tug&apos;ilgan sana
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Jinsi
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Tuman
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Yaratilgan
                  </th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                    Amal
                  </th>
                </tr>
              </thead>
              <tbody>
                {searchingPatients ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Loader2 className="w-7 h-7 animate-spin mx-auto" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground mt-3">Yuklanmoqda...</p>
                    </td>
                  </tr>
                ) : patientMatches.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      {patientSearched ? (
                        <>
                          <UserPlus className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-medium text-foreground">Bemor topilmadi</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Bemorlar sahifasidan yangi bemor qo&apos;shishingiz mumkin
                          </p>
                        </>
                      ) : (
                        <>
                          <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                          <p className="text-sm font-medium text-foreground">Bemorlar ro&apos;yxati</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Filter orqali bemorni toping
                          </p>
                        </>
                      )}
                    </td>
                  </tr>
                ) : (
                  patientMatches.map(p => (
                    <tr
                      key={p.id}
                      className="border-b border-border hover:bg-secondary/30 transition-colors group cursor-pointer"
                      onClick={() => onPatientChange(p.id)}
                    >
                      <td className="px-4 py-3 text-[13px] font-mono text-muted-foreground">
                        #{p.id}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-[13px] font-semibold text-foreground">
                          {p.last_name} {p.first_name}
                        </p>
                        {p.village || p.street ? (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[220px]">
                            {[p.village, p.street].filter(Boolean).join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground whitespace-nowrap">
                        {p.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {formatBirthDay(p.birth_day)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground">
                        {sexLabel(p.sex)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {p.district?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground whitespace-pre-line">
                        {p.createdAt ? formatDate(p.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {onEditPatient && (
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                onEditPatient(p.id);
                              }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                              title="Tahrirlash"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onPatientChange(p.id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white transition-all hover:opacity-90 opacity-90 group-hover:opacity-100"
                            style={{ background: primaryColor }}
                          >
                            Tanlash
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : loading ? (
        <div className="bg-card rounded-2xl border border-border p-12 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: primaryColor }} />
          <p className="text-sm text-muted-foreground">Bemor yuklanmoqda...</p>
        </div>
      ) : error ? (
        <div className="bg-card rounded-2xl border border-red-200 p-8 flex flex-col items-center gap-3">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-sm text-foreground">{error}</p>
          <button
            type="button"
            onClick={clearPatient}
            className="text-sm font-semibold"
            style={{ color: primaryColor }}
          >
            Boshqa bemorni tanlash
          </button>
        </div>
      ) : patient ? (
        <>
          <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto ses-scrollbar">
              <table className="w-full min-w-[1000px] text-left">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bemor
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Analiz turi
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Narx
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Chegirma
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      To&apos;lov turi
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      To&apos;lov qilish
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Holat
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      SMS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="align-top">
                    <td className="px-4 py-4 border-b border-border min-w-[200px]">
                      <p className="text-[13px] font-semibold text-foreground">
                        {patient.last_name} {patient.first_name}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-1">
                        Tel: {patient.phone || "—"}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5">
                        Tuman: {patient.district?.name ?? "—"}
                      </p>
                      <p className="text-[12px] text-muted-foreground mt-0.5 whitespace-pre-line">
                        Sana:{" "}
                        {patient.createdAt ? formatDate(patient.createdAt) : "—"}
                      </p>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[220px]">
                      <div className="space-y-2">
                        {items.map(item => (
                          <div
                            key={item.key}
                            className="flex items-start justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">
                                {item.analysis_name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {item.laboratory_name}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setRemoveTargetKey(item.key)}
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                              title="O'chirish"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setAnalysisModalOpen(true)}
                          disabled={refsLoading}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                        >
                          {refsLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Analiz qo&apos;shish
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[140px]">
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        ) : (
                          items.map(item => (
                            <div
                              key={item.key}
                              className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] font-medium text-foreground"
                            >
                              {formatPrice(item.price)}
                            </div>
                          ))
                        )}
                        {items.length > 0 && (
                          <p className="text-[12px] font-semibold pt-1" style={{ color: primaryColor }}>
                            Jami: {formatPrice(totalPrice)}
                          </p>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <div className="relative">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="any"
                          value={discountPercent}
                          onChange={e => {
                            setDiscountPercent(e.target.value);
                            setPaymentPaid(false);
                          }}
                          placeholder="0"
                          className="w-full bg-secondary border border-border rounded-xl px-3 py-2 pr-8 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground pointer-events-none">
                          %
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[160px]">
                      <div className="space-y-2">
                        {paymentMethod && (
                          <div className="rounded-xl bg-secondary/60 px-3 py-2 text-[13px] font-medium text-foreground">
                            {paymentLabel}
                          </div>
                        )}
                        {paymentPickerOpen ? (
                          <select
                            autoFocus
                            value={paymentMethod ?? ""}
                            onChange={e => {
                              const v = e.target.value as PaymentMethod;
                              if (v) {
                                setPaymentMethod(v);
                                setPaymentPickerOpen(false);
                                setPaymentPaid(false);
                              }
                            }}
                            onBlur={() => {
                              if (paymentMethod) setPaymentPickerOpen(false);
                            }}
                            className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
                          >
                            <option value="">Tanlang</option>
                            {PAYMENT_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPaymentPickerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            {paymentMethod ? "O'zgartirish" : "To'lov turi"}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[140px]">
                      <div className="space-y-2">
                        {paymentPaid ? (
                          <>
                            <div className="rounded-xl px-3 py-2 text-[12px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {statusLabel("paid")}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {formatPrice(paidAmount)}
                            </p>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={openPaymentModal}
                            disabled={items.length === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold border border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            To&apos;lov qilish
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <div className="space-y-2">
                        {items.length === 0 ? (
                          <span className="text-[12px] text-muted-foreground">—</span>
                        ) : (
                          items.map(item => (
                            <div
                              key={item.key}
                              className="rounded-xl px-3 py-2 text-[12px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            >
                              {statusLabel(item.status)}
                            </div>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 border-b border-border min-w-[120px]">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={sendSms}
                          onChange={e => setSendSms(e.target.checked)}
                          className="sr-only"
                        />
                        <span
                          className={`w-9 h-5 rounded-full relative transition-colors ${
                            sendSms ? "" : "bg-secondary border border-border"
                          }`}
                          style={sendSms ? { background: primaryColor } : undefined}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              sendSms ? "left-4" : "left-0.5"
                            }`}
                          />
                        </span>
                        <span className="text-[12px] text-foreground flex items-center gap-1">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                          {sendSms ? "Ha" : "Yo'q"}
                        </span>
                      </label>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={clearPatient}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
            >
              Bekor qilish
            </button>
            {paymentPaid && (
              <button
                type="button"
                onClick={() => void openReceipt()}
                disabled={receiptLoading || submitting || items.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {receiptLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                Chek
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting || receiptLoading || items.length === 0 || !paymentMethod}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: primaryColor }}
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Buyurtma yaratish
            </button>
          </div>
        </>
      ) : null}

      {analysisModalOpen && (
        <AnalysisPickModal
          laboratories={laboratories}
          analyses={analyses}
          primaryColor={primaryColor}
          existingKeys={existingKeys}
          onSave={handleAddAnalysis}
          onClose={() => setAnalysisModalOpen(false)}
        />
      )}

      {paymentModalOpen && (
        <PaymentModal
          primaryColor={primaryColor}
          initialMethod={paymentMethod}
          initialAmount={amountDue}
          onConfirm={handlePaymentConfirm}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      {receiptOpen && patient && paymentMethod && (
        <ReceiptModal
          primaryColor={primaryColor}
          patient={patient}
          items={items}
          paymentMethod={paymentMethod}
          paidAmount={paidAmount}
          discountPercent={parsedDiscount}
          totalBeforeDiscount={totalPrice}
          resultLinks={receiptLinks}
          onClose={() => setReceiptOpen(false)}
        />
      )}

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setRemoveTargetKey(null)}
          />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">
                Analizni o&apos;chirish
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  {removeTarget.analysis_name}
                </span>
                {" "}ni ro&apos;yxatdan o&apos;chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setRemoveTargetKey(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => handleRemoveItem(removeTarget.key)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
              >
                Ha, o&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
