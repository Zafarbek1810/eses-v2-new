import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, X, Edit3, Trash2, RefreshCw, LayoutTemplate,
  CheckCircle, AlertCircle, Loader2, FlaskConical, TestTube2,
  Minus,
} from "lucide-react";
import {
  getAllPatterns,
  addPattern,
  updatePattern,
  deletePattern,
  resolvePatternAnalysisId,
  type Pattern,
  type PatternPayload,
} from "@/api/pattern";
import { getAllAnalyses, type Analysis } from "@/api/analysis";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };
type InnerTab = "form" | "list";

type PatternRowForm = {
  key: string;
  name: string;
  have_or_not: boolean;
  unit: string;
  norm: string;
  min: string;
  max: string;
  standard: string;
};

const EMPTY_ROW = (): PatternRowForm => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: "",
  have_or_not: true,
  unit: "",
  norm: "",
  min: "",
  max: "",
  standard: "",
});

function toNullableNumber(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toNullableString(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function rowToPayload(row: PatternRowForm, analysisId: number): PatternPayload {
  return {
    analysis_id: analysisId,
    name: row.name.trim(),
    have_or_not: row.have_or_not,
    unit: toNullableString(row.unit),
    norm: toNullableString(row.norm),
    min: toNullableNumber(row.min),
    max: toNullableNumber(row.max),
    standard: toNullableString(row.standard),
    have_or_notValue: null,
    unitValue: null,
    normValue: null,
    minValue: null,
    maxValue: null,
    standardValue: null,
  };
}

function patternToRow(p: Pattern): PatternRowForm {
  return {
    key: String(p.id),
    name: p.name ?? "",
    have_or_not: Boolean(p.have_or_not),
    unit: p.unit ?? "",
    norm: p.norm ?? "",
    min: p.min == null ? "" : String(p.min),
    max: p.max == null ? "" : String(p.max),
    standard: p.standard ?? "",
  };
}

const inputCls =
  "w-full bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-[var(--primary)]";

function PatternRowFields({
  row,
  onChange,
  onRemove,
  showRemove,
  primaryColor,
}: {
  row: PatternRowForm;
  onChange: (next: PatternRowForm) => void;
  onRemove?: () => void;
  showRemove?: boolean;
  primaryColor: string;
}) {
  const set = <K extends keyof PatternRowForm>(k: K, v: PatternRowForm[K]) => {
    onChange({ ...row, [k]: v });
  };

  return (
    <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Pattern nomi *
            </label>
            <input
              type="text"
              value={row.name}
              placeholder="Masalan: Gemoglobin"
              onChange={e => set("name", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Birlik (unit)
            </label>
            <input
              type="text"
              value={row.unit}
              placeholder="g/dL"
              onChange={e => set("unit", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Norma (norm)
            </label>
            <input
              type="text"
              value={row.norm}
              placeholder="12.0 - 16.0"
              onChange={e => set("norm", e.target.value)}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Min
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={row.min}
              placeholder="12.000"
              onChange={e => set("min", e.target.value.replace(/[^\d.-]/g, ""))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Max
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={row.max}
              placeholder="16.000"
              onChange={e => set("max", e.target.value.replace(/[^\d.-]/g, ""))}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              Standart
            </label>
            <input
              type="text"
              value={row.standard}
              placeholder="ISO-9001"
              onChange={e => set("standard", e.target.value)}
              className={inputCls}
            />
          </div>
        </div>
        {showRemove && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="mt-6 p-2 rounded-xl border border-border text-muted-foreground hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors shrink-0"
            title="Qatorni olib tashlash"
          >
            <Minus className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="inline-flex items-center gap-2 text-[12px] text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={row.have_or_not}
            onChange={e => set("have_or_not", e.target.checked)}
            className="rounded border-border"
            style={{ accentColor: primaryColor }}
          />
          Bor / yo&apos;q (have_or_not)
        </label>
      </div>
    </div>
  );
}

function EditPatternModal({
  item,
  analyses,
  primaryColor,
  saving,
  onSave,
  onClose,
}: {
  item: Pattern;
  analyses: Analysis[];
  primaryColor: string;
  saving: boolean;
  onSave: (payload: PatternPayload) => void;
  onClose: () => void;
}) {
  const initialAnalysisId = resolvePatternAnalysisId(item);
  const [row, setRow] = useState<PatternRowForm>(() => patternToRow(item));
  const [analysisId, setAnalysisId] = useState<number | "">(
    initialAnalysisId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const analysisOptions = useMemo(() => {
    const list = [...analyses];
    const currentId = resolvePatternAnalysisId(item);
    if (currentId != null && !list.some(a => a.id === currentId) && item.analysis) {
      list.unshift({
        id: item.analysis.id,
        name: item.analysis.name,
        shortname: item.analysis.shortname ?? "",
        price: "",
        createdAt: "",
        laboratory: item.analysis.laboratory
          ? {
              id: item.analysis.laboratory.id,
              name: item.analysis.laboratory.name,
              createdAt: "",
              lab_director: null,
            }
          : null,
      });
    }
    return list;
  }, [analyses, item]);

  const handleSubmit = () => {
    if (!row.name.trim()) {
      setError("Pattern nomi majburiy");
      return;
    }
    const resolved =
      typeof analysisId === "number" && Number.isFinite(analysisId) && analysisId > 0
        ? analysisId
        : resolvePatternAnalysisId(item);
    if (resolved == null) {
      setError("Analiz tanlang");
      return;
    }
    setError(null);
    onSave(rowToPayload(row, resolved));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border shrink-0">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">Patternni tahrirlash</h2>
            <p className="text-xs text-muted-foreground mt-0.5">#{item.id} — ma&apos;lumotlarni yangilang</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto ses-scrollbar p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">Analiz *</label>
            <select
              value={analysisId === "" ? "" : String(analysisId)}
              onChange={e => setAnalysisId(e.target.value ? Number(e.target.value) : "")}
              className={inputCls}
            >
              <option value="">Analiz tanlang</option>
              {analysisOptions.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name}{a.laboratory?.name ? ` — ${a.laboratory.name}` : ""}
                </option>
              ))}
            </select>
          </div>
          <PatternRowFields row={row} onChange={setRow} primaryColor={primaryColor} />
          {error && <p className="text-[12px] text-red-500">{error}</p>}
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
            onClick={handleSubmit}
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

export function PatternsSection({ primaryColor }: { primaryColor: string }) {
  const [innerTab, setInnerTab] = useState<InnerTab>("form");
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [labId, setLabId] = useState<number | "">("");
  const [analysisId, setAnalysisId] = useState<number | "">("");
  const [rows, setRows] = useState<PatternRowForm[]>([EMPTY_ROW()]);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modal, setModal] = useState<
    | { type: "edit"; item: Pattern }
    | { type: "delete"; item: Pattern }
    | null
  >(null);

  const pushToast = (text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  };

  const labAnalyses = useMemo(() => {
    if (labId === "") return [];
    return analyses.filter(a => a.laboratory?.id === labId);
  }, [analyses, labId]);

  const loadMeta = async () => {
    setLoadingMeta(true);
    try {
      const [labs, anals] = await Promise.all([getAllLaboratories(), getAllAnalyses()]);
      setLaboratories(Array.isArray(labs) ? labs : []);
      setAnalyses(Array.isArray(anals) ? anals : []);
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Ma'lumotlarni yuklab bo'lmadi", "error");
      setLaboratories([]);
      setAnalyses([]);
    } finally {
      setLoadingMeta(false);
    }
  };

  const loadPatterns = async () => {
    setLoadingPatterns(true);
    setError(null);
    try {
      const list = await getAllPatterns();
      setPatterns(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Patternlarni yuklab bo'lmadi");
      setPatterns([]);
    } finally {
      setLoadingPatterns(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (innerTab === "list") void loadPatterns();
  }, [innerTab]);

  const selectLab = (id: number) => {
    setLabId(id);
    setAnalysisId("");
    setRows([EMPTY_ROW()]);
  };

  const selectAnalysis = (id: number) => {
    setAnalysisId(id);
    setRows([EMPTY_ROW()]);
  };

  const updateRow = (key: string, next: PatternRowForm) => {
    setRows(list => list.map(r => (r.key === key ? next : r)));
  };

  const addRow = () => setRows(list => [...list, EMPTY_ROW()]);

  const removeRow = (key: string) => {
    setRows(list => (list.length <= 1 ? list : list.filter(r => r.key !== key)));
  };

  const handleSaveRows = async () => {
    if (analysisId === "") {
      pushToast("Avval analizni tanlang", "error");
      return;
    }
    const valid = rows.filter(r => r.name.trim());
    if (valid.length === 0) {
      pushToast("Kamida bitta pattern nomi kiriting", "error");
      return;
    }

    setSaving(true);
    try {
      for (const row of valid) {
        await addPattern(rowToPayload(row, analysisId));
      }
      pushToast(`${valid.length} ta pattern qo'shildi`);
      setRows([EMPTY_ROW()]);
      if (innerTab === "list") await loadPatterns();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Saqlashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (payload: PatternPayload) => {
    if (modal?.type !== "edit") return;
    setSaving(true);
    try {
      await updatePattern(modal.item.id, payload);
      pushToast(`${payload.name} yangilandi`);
      setModal(null);
      await loadPatterns();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "Yangilashda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (modal?.type !== "delete") return;
    setSaving(true);
    try {
      await deletePattern(modal.item.id);
      pushToast(`${modal.item.name} o'chirildi`, "error");
      setModal(null);
      await loadPatterns();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  const analysisNameById = (id: number | null | undefined) => {
    if (id == null) return "—";
    return (
      analyses.find(a => a.id === id)?.name ??
      patterns.find(p => resolvePatternAnalysisId(p) === id)?.analysis?.name ??
      `#${id}`
    );
  };

  const innerTabs: { id: InnerTab; label: string }[] = [
    { id: "form", label: "Pattern kiritish" },
    { id: "list", label: "Patternlar jadvali" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-border">
          {innerTabs.map(tab => {
            const active = innerTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setInnerTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-[13px] font-semibold whitespace-nowrap transition-colors ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutTemplate className="w-4 h-4" style={active ? { color: primaryColor } : undefined} />
                {tab.label}
                {active && (
                  <span
                    className="absolute left-3 right-3 bottom-0 h-0.5 rounded-full"
                    style={{ background: primaryColor }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {innerTab === "form" && (
        <div className="space-y-4">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Laboratoriyalar</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Laboratoriyani tanlang — keyin uning analizlari chiqadi
                </p>
              </div>
              <button
                onClick={() => void loadMeta()}
                className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
                title="Yangilash"
              >
                <RefreshCw className={`w-4 h-4 ${loadingMeta ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loadingMeta ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: primaryColor }} />
                <span className="text-sm">Yuklanmoqda…</span>
              </div>
            ) : laboratories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Laboratoriya topilmadi</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {laboratories.map(lab => {
                  const active = labId === lab.id;
                  return (
                    <button
                      key={lab.id}
                      type="button"
                      onClick={() => selectLab(lab.id)}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                        active
                          ? "text-white border-transparent shadow-sm"
                          : "bg-secondary border-border text-foreground hover:border-[var(--primary)]"
                      }`}
                      style={active ? { background: primaryColor } : undefined}
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      {lab.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {labId !== "" && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-[14px] font-semibold text-foreground">Analizlar</h3>
                <p className="text-[12px] text-muted-foreground mt-0.5">
                  Pattern kiritish uchun analizni tanlang
                </p>
              </div>
              {labAnalyses.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Bu laboratoriyada analiz topilmadi
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {labAnalyses.map(a => {
                    const active = analysisId === a.id;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => selectAnalysis(a.id)}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[13px] font-medium border transition-all ${
                          active
                            ? "text-white border-transparent shadow-sm"
                            : "bg-secondary border-border text-foreground hover:border-[var(--primary)]"
                        }`}
                        style={active ? { background: primaryColor } : undefined}
                      >
                        <TestTube2 className="w-3.5 h-3.5" />
                        {a.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {analysisId !== "" && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="text-[14px] font-semibold text-foreground">Patternlar</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Har bir qator — bitta pattern. Oxiridagi + tugmasi yangi qator ochadi.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveRows}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold transition-all hover:opacity-90 active:scale-[0.98] shadow-sm disabled:opacity-70"
                  style={{ background: primaryColor }}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Saqlash
                </button>
              </div>

              <div className="space-y-3">
                {rows.map((row, idx) => (
                  <div key={row.key} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Pattern {idx + 1}
                      </span>
                    </div>
                    <div className="flex gap-2 items-stretch">
                      <div className="flex-1 min-w-0">
                        <PatternRowFields
                          row={row}
                          onChange={next => updateRow(row.key, next)}
                          onRemove={() => removeRow(row.key)}
                          showRemove={rows.length > 1}
                          primaryColor={primaryColor}
                        />
                      </div>
                      {idx === rows.length - 1 && (
                        <button
                          type="button"
                          onClick={addRow}
                          className="self-center shrink-0 w-11 h-11 rounded-xl text-white flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
                          style={{ background: primaryColor }}
                          title="Yangi pattern qatori"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {innerTab === "list" && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-foreground">Barcha patternlar</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Tahlil shablonlari ro&apos;yxati
              </p>
            </div>
            <button
              onClick={() => void loadPatterns()}
              className="p-2.5 rounded-xl hover:bg-secondary border border-border transition-colors text-muted-foreground"
              title="Yangilash"
            >
              <RefreshCw className={`w-4 h-4 ${loadingPatterns ? "animate-spin" : ""}`} />
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
                  {["Pattern", "Analiz", "Unit", "Norma", "Min–Max", "Standart", "Bor/yo'q", "Yaratilgan", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-5 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingPatterns ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: primaryColor }} />
                        <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                      </div>
                    </td>
                  </tr>
                ) : patterns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center">
                          <LayoutTemplate className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Pattern topilmadi</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Birinchi tabdan yangi pattern qo&apos;shing
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  patterns.map(item => (
                    <tr key={item.id} className="border-b border-border hover:bg-secondary/30 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="text-[13px] font-semibold text-foreground leading-tight">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-mono">#{item.id}</div>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                        {item.analysis?.name ?? analysisNameById(resolvePatternAnalysisId(item))}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">
                        {item.unit || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap">
                        {item.norm || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-foreground whitespace-nowrap font-mono">
                        {item.min != null || item.max != null
                          ? `${item.min ?? "—"} – ${item.max ?? "—"}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-nowrap">
                        {item.standard || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-lg text-[11px] font-semibold ${
                            item.have_or_not
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {item.have_or_not ? "Ha" : "Yo'q"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-muted-foreground whitespace-pre-line">
                        {item.createdAt ? formatDate(item.createdAt) : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setModal({ type: "edit", item })}
                            className="p-1.5 rounded-lg hover:bg-violet-50 hover:text-violet-600 text-muted-foreground transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setModal({ type: "delete", item })}
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
        </div>
      )}

      {modal?.type === "edit" && (
        <EditPatternModal
          item={modal.item}
          analyses={analyses}
          primaryColor={primaryColor}
          saving={saving}
          onSave={handleUpdate}
          onClose={() => setModal(null)}
        />
      )}

      {modal?.type === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setModal(null)} />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground text-[15px]">Patternni o&apos;chirish</h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  <span className="font-semibold text-foreground">{modal.item.name}</span> o&apos;chiriladi.
                  Bu amalni qaytarib bo&apos;lmaydi.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setModal(null)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => void handleDelete()}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-6 right-6 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg border text-[13px] font-medium min-w-[240px] ${
              t.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-200"
                : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/80 dark:border-red-800 dark:text-red-200"
            }`}
          >
            {t.type === "success" ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
