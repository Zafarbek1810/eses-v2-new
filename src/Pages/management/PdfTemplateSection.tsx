import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Type, Heading1, Heading2, Heading3, Image as ImageIcon, Table2,
  Bold, Italic, Underline, Trash2, Save, Plus, RefreshCw, CheckCircle,
  AlertCircle, Loader2, FileText, MousePointer2, AlignLeft, AlignCenter,
  AlignRight, GripVertical, X, Upload, Database, Minus, Combine, Globe,
  ArrowLeft,
} from "lucide-react";
import { getAllAnalyses, type Analysis } from "@/api/analysis";
import { getAllLaboratories, type Laboratory } from "@/api/laboratory";
import { getCompanyById, type Company } from "@/api/company";
import { getStoredCompanyId } from "@/api/session";
import { ApiError } from "@/api/client";
import { CustomPdfTable } from "@/components/CustomPdfTable";
import {
  A4_HEIGHT,
  A4_PREVIEW_HEIGHT,
  A4_PREVIEW_SCALE,
  A4_PREVIEW_WIDTH,
  A4_WIDTH,
  DYNAMIC_FIELDS,
  PDF_MAX_PAGES,
  createDynamicElement,
  createEmptyTableData,
  createPdfElement,
  createTemplateId,
  deletePdfTemplateRemote,
  fetchPdfTemplatesFromApi,
  formatDynamicDisplay,
  getDynamicFieldDef,
  getPdfPageCount,
  getPdfPreviewHeight,
  loadPdfTemplates,
  mergeBodySelection,
  mergeHeaderSelection,
  normalizeSelection,
  normalizeTableData,
  resizeBodyRows,
  resizeHeaderRows,
  resizeTableCols,
  resolvePdfTemplateAnalysisId,
  setActiveTemplateId,
  setColWidthAt,
  tableHeightForRows,
  unmergeBodySelection,
  unmergeHeaderSelection,
  updateBodyCell,
  updateColWidths,
  updateHeaderCell,
  upsertPdfTemplateGlobal,
  upsertPdfTemplateRemote,
  type PdfDynamicFieldKey,
  type PdfElement,
  type PdfElementType,
  type PdfTableData,
  type PdfTableSelection,
  type PdfTemplate,
  type PdfTextStyle,
  type PdfTableCell,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

function laboratoryCompanyId(lab: Laboratory): number | null {
  const value = lab.company?.id ?? lab.company_id ?? lab.companyId;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function companyLaboratories(company: Company): Laboratory[] {
  const raw = company as Company & {
    laboratory?: unknown;
    laboratories?: unknown;
    labs?: unknown;
  };
  const candidate = raw.laboratory ?? raw.laboratories ?? raw.labs;
  return Array.isArray(candidate) ? candidate as Laboratory[] : [];
}

function scopeLaboratories(allLabs: Laboratory[], company: Company | null, companyId: number): Laboratory[] {
  const fromApi = Array.isArray(allLabs) ? allLabs : [];
  const matching = fromApi.filter(lab => {
    const cid = laboratoryCompanyId(lab);
    return cid == null || cid === companyId;
  });
  if (matching.length > 0) return matching;
  return company ? companyLaboratories(company) : [];
}

type ToolDef = {
  type: PdfElementType;
  label: string;
  icon: React.ElementType;
  hint: string;
};

const TOOLS: ToolDef[] = [
  { type: "heading1", label: "Sarlavha 1", icon: Heading1, hint: "Katta sarlavha" },
  { type: "heading2", label: "Sarlavha 2", icon: Heading2, hint: "O'rta sarlavha" },
  { type: "heading3", label: "Sarlavha 3", icon: Heading3, hint: "Kichik sarlavha" },
  { type: "text", label: "Matn", icon: Type, hint: "Oddiy matn bloki" },
  { type: "image", label: "Rasm", icon: ImageIcon, hint: "Rasm joylash" },
  { type: "table", label: "Jadval", icon: Table2, hint: "Header + body qo'lda, ustun kengligi" },
];

type DragPayload =
  | { kind: "tool"; type: PdfElementType }
  | { kind: "dynamic"; key: PdfDynamicFieldKey };

export function emptyTemplate(
  analysis?: { id: number; name: string } | null,
  options?: { fromBaseCatalog?: boolean },
): PdfTemplate {
  const now = new Date().toISOString();
  return {
    id: createTemplateId(),
    name: analysis?.name ? `${analysis.name} shablon` : "Yangi PDF shablon",
    elements: [],
    createdAt: now,
    updatedAt: now,
    analysisId: analysis?.id ?? null,
    analysisName: analysis?.name ?? "",
    baseAnalysisId: options?.fromBaseCatalog ? analysis?.id ?? null : null,
  };
}

export function NewTemplateModal({
  laboratories,
  analyses,
  primaryColor,
  onConfirm,
  onClose,
  title = "Yangi PDF shablon",
  description = "Laboratoriya va analizni tanlang",
  confirmLabel = "Davom etish",
  initialAnalysisId = null,
}: {
  laboratories: Laboratory[];
  analyses: Analysis[];
  primaryColor: string;
  onConfirm: (analysis: Analysis) => void;
  onClose: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  initialAnalysisId?: number | null;
}) {
  const initialAnalysis =
    initialAnalysisId != null && initialAnalysisId > 0
      ? (Array.isArray(analyses) ? analyses : []).find(a => a.id === initialAnalysisId) ?? null
      : null;
  const [labId, setLabId] = useState<string>(
    initialAnalysis?.laboratory?.id ? String(initialAnalysis.laboratory.id) : "",
  );
  const [analysisId, setAnalysisId] = useState<string>(
    initialAnalysis ? String(initialAnalysis.id) : "",
  );
  const [error, setError] = useState<string | null>(null);

  const labAnalyses = useMemo(() => {
    if (!labId) return [];
    const id = Number(labId);
    const list = Array.isArray(analyses) ? analyses : [];
    return list.filter(a => a.laboratory?.id === id);
  }, [analyses, labId]);

  const submit = () => {
    const id = Number(analysisId);
    const list = Array.isArray(analyses) ? analyses : [];
    const found = labAnalyses.find(a => a.id === id) ?? list.find(a => a.id === id);
    if (!found) {
      setError("Analizni tanlang");
      return;
    }
    onConfirm(found);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground text-[15px]">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
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
              Laboratoriya *
            </label>
            <select
              value={labId}
              onChange={e => {
                setLabId(e.target.value);
                setAnalysisId("");
                setError(null);
              }}
              className="w-full bg-secondary border border-border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)]"
            >
              <option value="">Laboratoriyani tanlang...</option>
              {(Array.isArray(laboratories) ? laboratories : []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Analiz *
            </label>
            <select
              value={analysisId}
              disabled={!labId}
              onChange={e => {
                setAnalysisId(e.target.value);
                setError(null);
              }}
              className={`w-full bg-secondary border rounded-xl px-3.5 py-2.5 text-[13px] text-foreground focus:outline-none disabled:opacity-60 ${
                error ? "border-red-400" : "border-border focus:border-[var(--primary)]"
              }`}
            >
              <option value="">
                {labId ? "Analizni tanlang..." : "Avval laboratoriya tanlang"}
              </option>
              {labAnalyses.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
          >
            Bekor qilish
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export type PdfOpenForAnalysis = {
  id: number;
  name: string;
  laboratoryId: number | null;
  hasTemplate: boolean;
};

export function PdfTemplateSection({
  primaryColor,
  importTemplate = null,
  onImportConsumed,
  openForAnalysis = null,
  onOpenForAnalysisConsumed,
  globalEditTemplate = null,
  onGlobalEditConsumed,
  onGlobalEditClose,
  onGlobalEditSaved,
  companyId,
}: {
  primaryColor: string;
  importTemplate?: PdfTemplate | null;
  onImportConsumed?: () => void;
  openForAnalysis?: PdfOpenForAnalysis | null;
  onOpenForAnalysisConsumed?: () => void;
  /** Global PDF bo'limidan: shu global yozuvni joyida tahrirlash */
  globalEditTemplate?: PdfTemplate | null;
  onGlobalEditConsumed?: () => void;
  onGlobalEditClose?: () => void;
  onGlobalEditSaved?: () => void;
  companyId?: number;
}) {
  const scopedCompanyId = companyId ?? getStoredCompanyId() ?? undefined;
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [template, setTemplate] = useState<PdfTemplate>(() => emptyTemplate());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [laboratories, setLaboratories] = useState<Laboratory[]>([]);
  const [filterLabId, setFilterLabId] = useState<string>("");
  const [filterAnalysisId, setFilterAnalysisId] = useState<string>("");
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [elementDeleteId, setElementDeleteId] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PdfTemplate | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [isGlobalEditMode, setIsGlobalEditMode] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [dragTool, setDragTool] = useState<DragPayload | null>(null);
  const [tableSel, setTableSel] = useState<PdfTableSelection | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const propsPanelRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => template.elements.find(e => e.id === selectedId) ?? null,
    [template.elements, selectedId],
  );

  const filterLabAnalyses = useMemo(() => {
    if (!filterLabId) return [];
    const id = Number(filterLabId);
    const list = Array.isArray(analyses) ? analyses : [];
    return list.filter(a => a.laboratory?.id === id);
  }, [analyses, filterLabId]);

  const filteredTemplates = useMemo(() => {
    if (!filterAnalysisId) return [];
    const id = Number(filterAnalysisId);
    const list = Array.isArray(templates) ? templates : [];
    return list.filter(t => resolvePdfTemplateAnalysisId(t) === id);
  }, [templates, filterAnalysisId]);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const applyLoadedTemplates = (list: PdfTemplate[]) => {
    setTemplates(list);
  };

  const loadMeta = async () => {
    if (onGlobalEditClose) {
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    try {
      const [allAnalyses, allLabs, remoteTemplates, company] = await Promise.all([
        getAllAnalyses(scopedCompanyId),
        getAllLaboratories(scopedCompanyId),
        fetchPdfTemplatesFromApi(scopedCompanyId).catch(err => {
          console.warn("[PDF] onlinestorage/getall yuklanmadi:", err);
          return loadPdfTemplates();
        }),
        scopedCompanyId != null ? getCompanyById(scopedCompanyId) : Promise.resolve(null),
      ]);
      const labs = scopedCompanyId == null
        ? allLabs
        : scopeLaboratories(allLabs, company, scopedCompanyId);
      const labIds = new Set(labs.map(lab => lab.id));
      const analyses = scopedCompanyId == null
        ? allAnalyses
        : allAnalyses.filter(item => item.laboratory?.id == null || labIds.size === 0 || labIds.has(item.laboratory.id));
      setAnalyses(analyses);
      setLaboratories(labs);
      const analysisIds = new Set(analyses.map(item => item.id));
      const source = Array.isArray(remoteTemplates) ? remoteTemplates : loadPdfTemplates();
      const list = scopedCompanyId == null
        ? source
        : source.filter(item => {
            const id = resolvePdfTemplateAnalysisId(item);
            return id != null && analysisIds.has(id);
          });
      applyLoadedTemplates(list);
      if (list.length === 0) {
        pushToast("PDF shablonlar topilmadi (onlinestorage)", "error");
      }
    } catch (err) {
      // Analiz/lab xato bo'lsa ham sessiondagi shablonlarni ko'rsatamiz
      applyLoadedTemplates(loadPdfTemplates());
      pushToast(err instanceof ApiError ? err.message : "Ma'lumot yuklanmadi", "error");
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, [scopedCompanyId]);

  // Global PDF tab → "Tahrirlash": avval analiz tanlash, keyin editor
  useEffect(() => {
    if (!importTemplate) return;
    setPendingImport(structuredClone(importTemplate));
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setActiveTemplateId(null);
    setEditorOpen(false);
    setIsGlobalEditMode(false);
    onImportConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume once per import
  }, [importTemplate]);

  // Global PDF tab → joyida tahrirlash (globalStorageId saqlanadi)
  useEffect(() => {
    if (!globalEditTemplate) return;
    const next = structuredClone(globalEditTemplate);
    setTemplate(next);
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setActiveTemplateId(null);
    setPendingImport(null);
    setIsGlobalEditMode(true);
    setEditorOpen(true);
    onGlobalEditConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume once per open
  }, [globalEditTemplate]);

  // Analizlar → Shablon ustuni: shablon ochish yoki yangi yaratish
  useEffect(() => {
    if (!openForAnalysis || loadingMeta) return;

    const analysisId = openForAnalysis.id;
    const labId = openForAnalysis.laboratoryId;
    const fromMeta = analyses.find(a => a.id === analysisId);
    const analysis: Analysis = fromMeta ?? {
      id: analysisId,
      name: openForAnalysis.name,
      shortname: "",
      price: "",
      createdAt: "",
      laboratory: labId
        ? { id: labId, name: "", createdAt: "", lab_director: null }
        : null,
    };

    if (analysis.laboratory?.id) {
      setFilterLabId(String(analysis.laboratory.id));
    }
    setFilterAnalysisId(String(analysisId));

    const existing = templates.filter(
      t => resolvePdfTemplateAnalysisId(t) === analysisId,
    );

    if (openForAnalysis.hasTemplate && existing.length > 0) {
      const found = existing[0];
      setTemplate(structuredClone(found));
      setSelectedId(null);
      setEditingId(null);
      setTableSel(null);
      setActiveTemplateId(found.id);
      setEditorOpen(true);
    } else {
      const t = emptyTemplate({ id: analysis.id, name: analysis.name });
      setTemplate(t);
      setSelectedId(null);
      setEditingId(null);
      setTableSel(null);
      setActiveTemplateId(null);
      setEditorOpen(true);
    }

    onOpenForAnalysisConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consume once after meta load
  }, [openForAnalysis, loadingMeta]);

  // Scroll props into view when selection changes
  useEffect(() => {
    if (selectedId && propsPanelRef.current) {
      propsPanelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  const bindTemplateAnalysis = (tpl: PdfTemplate, analysis: Analysis): PdfTemplate => {
    const next = structuredClone(tpl);
    next.analysisId = analysis.id;
    next.analysisName = analysis.name;
    for (const el of next.elements) {
      if (el.type !== "table") continue;
      el.analysisId = analysis.id;
      el.analysisName = analysis.name;
    }
    return next;
  };

  const updateElement = (id: string, patch: Partial<PdfElement>) => {
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(el => (el.id === id ? { ...el, ...patch } : el)),
    }));
  };

  const updateStyle = (id: string, patch: Partial<PdfTextStyle>) => {
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(el =>
        el.id === id
          ? { ...el, style: { ...(el.style ?? {}), ...patch } }
          : el,
      ),
    }));
  };

  const removeElement = (id: string) => {
    setTemplate(t => ({ ...t, elements: t.elements.filter(el => el.id !== id) }));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
    setElementDeleteId(null);
  };

  const confirmRemoveElement = () => {
    if (!elementDeleteId) return;
    removeElement(elementDeleteId);
  };

  const selectElement = (id: string, options?: { keepTableSel?: boolean }) => {
    if (selectedId !== id && !options?.keepTableSel) {
      setTableSel(null);
    }
    setSelectedId(id);
    setEditingId(null);
  };

  const dropToolOnCanvas = (payload: DragPayload, clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (clientX - rect.left) / A4_PREVIEW_SCALE;
    const y = (clientY - rect.top) / A4_PREVIEW_SCALE;
    const el =
      payload.kind === "dynamic"
        ? createDynamicElement(payload.key, x - 40, y - 10)
        : createPdfElement(
            payload.type,
            x - 40,
            y - 16,
            payload.type === "table" && template.analysisId
              ? {
                  analysisId: template.analysisId,
                  analysisName: template.analysisName ?? "",
                }
              : undefined,
          );
    setTemplate(t => ({ ...t, elements: [...t.elements, el] }));
    setSelectedId(el.id);
    setEditingId(null);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    let payload: DragPayload | null = dragTool;
    try {
      const raw = e.dataTransfer.getData("application/x-pdf-tool");
      if (raw) payload = JSON.parse(raw) as DragPayload;
    } catch {
      /* ignore */
    }
    setDragTool(null);
    if (!payload) return;
    dropToolOnCanvas(payload, e.clientX, e.clientY);
  };

  const handleElementDrag = (id: string, dx: number, dy: number) => {
    const maxY = A4_HEIGHT * PDF_MAX_PAGES - 20;
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(el => {
        if (el.id !== id) return el;
        return {
          ...el,
          x: Math.max(0, Math.min(el.x + dx / A4_PREVIEW_SCALE, A4_WIDTH - el.width)),
          y: Math.max(0, Math.min(el.y + dy / A4_PREVIEW_SCALE, maxY)),
        };
      }),
    }));
  };

  const handleElementResize = (
    id: string,
    next: { x: number; y: number; width: number; height: number },
  ) => {
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(el => (el.id === id ? { ...el, ...next } : el)),
    }));
  };

  const handleSave = async () => {
    if (isGlobalEditMode) {
      setSavingGlobal(true);
      try {
        const saved = await upsertPdfTemplateGlobal(template, companyId ?? template.companyId ?? undefined);
        setTemplate(saved);
        pushToast("Global PDF shablon yangilandi");
        onGlobalEditSaved?.();
      } catch (err) {
        pushToast(
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Globalga saqlab bo'lmadi",
          "error",
        );
      } finally {
        setSavingGlobal(false);
      }
      return;
    }

    setSaving(true);
    try {
      const saved = await upsertPdfTemplateRemote(template, scopedCompanyId);
      setTemplate(saved);
      setTemplates(loadPdfTemplates());
      pushToast("PDF shablon bazaga saqlandi");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Saqlab bo'lmadi",
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCloseGlobalEdit = () => {
    setIsGlobalEditMode(false);
    setEditorOpen(false);
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setTemplate(emptyTemplate());
    onGlobalEditClose?.();
  };

  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    try {
      const saved = await upsertPdfTemplateGlobal(template, companyId ?? template.companyId ?? undefined);
      setTemplate(t => ({
        ...t,
        globalStorageId: saved.globalStorageId,
        companyId: saved.companyId,
      }));
      pushToast("Global PDF shablonga saqlandi");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Globalga saqlab bo'lmadi",
        "error",
      );
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleNew = () => {
    setNewModalOpen(true);
  };

  const handleConfirmNew = (analysis: Analysis) => {
    const t = emptyTemplate({ id: analysis.id, name: analysis.name });
    setTemplate(t);
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setActiveTemplateId(null);
    setIsGlobalEditMode(false);
    setNewModalOpen(false);
    setEditorOpen(true);
    if (analysis.laboratory?.id) {
      setFilterLabId(String(analysis.laboratory.id));
      setFilterAnalysisId(String(analysis.id));
    }
  };

  const handleConfirmImport = (analysis: Analysis) => {
    if (!pendingImport) return;
    const t = bindTemplateAnalysis(pendingImport, analysis);
    setTemplate(t);
    setPendingImport(null);
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setActiveTemplateId(null);
    setEditorOpen(true);
    if (analysis.laboratory?.id) {
      setFilterLabId(String(analysis.laboratory.id));
      setFilterAnalysisId(String(analysis.id));
    }
    pushToast(`"${analysis.name}" uchun ochildi — Saqlash bilan online storage'ga yoziladi`);
  };

  const handleCancelImport = () => {
    setPendingImport(null);
  };

  const handleLoad = (id: string) => {
    const found = templates.find(t => t.id === id);
    if (!found) return;
    setTemplate(structuredClone(found));
    setSelectedId(null);
    setEditingId(null);
    setTableSel(null);
    setActiveTemplateId(id);
    setIsGlobalEditMode(false);
    setEditorOpen(true);
    const analysisId = resolvePdfTemplateAnalysisId(found);
    if (analysisId) {
      const analysis = analyses.find(a => a.id === analysisId);
      if (analysis?.laboratory?.id) {
        setFilterLabId(String(analysis.laboratory.id));
      }
      setFilterAnalysisId(String(analysisId));
    }
  };

  const handleDeleteTemplate = async () => {
    const id = deleteConfirmId;
    if (!id) return;
    const target = templates.find(t => t.id === id) ?? (template.id === id ? template : null);
    if (!target) {
      setDeleteConfirmId(null);
      return;
    }
    setDeleting(true);
    try {
      await deletePdfTemplateRemote(target);
      const list = loadPdfTemplates();
      setTemplates(list);
      if (template.id === id) {
        setTemplate(emptyTemplate());
        setSelectedId(null);
        setEditingId(null);
        setTableSel(null);
        setEditorOpen(false);
      }
      setDeleteConfirmId(null);
      pushToast("Shablon o'chirildi");
    } catch (err) {
      pushToast(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "O'chirib bo'lmadi",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const deleteConfirmTarget =
    deleteConfirmId != null
      ? templates.find(t => t.id === deleteConfirmId) ??
        (template.id === deleteConfirmId ? template : null)
      : null;

  const applyImageFile = (file: File | null, elementId: string) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateElement(elementId, { imageSrc: String(reader.result || "") });
    };
    reader.readAsDataURL(file);
  };

  const setSelectedTableData = (tableData: PdfTableData) => {
    if (!selected || selected.type !== "table") return;
    const td = normalizeTableData(tableData);
    updateElement(selected.id, {
      tableData: td,
      height: tableHeightForRows(td.headerRows, td.bodyRows),
    });
  };

  const handleSelectCell = (
    section: "header" | "body",
    row: number,
    col: number,
    shiftKey: boolean,
  ) => {
    setTableSel(prev => {
      if (shiftKey && prev && prev.section === section) {
        return { section, r1: prev.r1, c1: prev.c1, r2: row, c2: col };
      }
      return { section, r1: row, c1: col, r2: row, c2: col };
    });
  };

  const isTextual = selected && ["heading1", "heading2", "heading3", "text"].includes(selected.type);
  const canStyleText = Boolean(isTextual || selected?.type === "dynamic");
  const pageCount = getPdfPageCount(template);
  const previewHeight = getPdfPreviewHeight(template);

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4 flex flex-wrap items-center gap-3">
        {isGlobalEditMode && (
          <button
            type="button"
            onClick={handleCloseGlobalEdit}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Orqaga
          </button>
        )}
        {editorOpen ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              value={template.name}
              onChange={e => setTemplate(t => ({ ...t, name: e.target.value }))}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-[var(--primary)] w-full max-w-xs"
              placeholder="Shablon nomi"
            />
            {template.analysisId ? (
              <span
                className="hidden sm:inline-flex items-center max-w-[200px] truncate px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-foreground"
                style={{ background: `${primaryColor}18` }}
                title={template.analysisName || `Analiz #${template.analysisId}`}
              >
                {template.analysisName || `Analiz #${template.analysisId}`}
              </span>
            ) : null}
            {isGlobalEditMode && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-violet-700 bg-violet-500/10">
                <Globe className="w-3 h-3" /> {template.globalStorageId ? "Global tahrirlash" : "Yangi global shablon"}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-[13px] text-muted-foreground">
              Laboratoriya va analizni tanlab, saqlangan shablonni oching
            </p>
          </div>
        )}
        {!isGlobalEditMode && (
          <>
            <select
              value={filterLabId}
              onChange={e => {
                setFilterLabId(e.target.value);
                setFilterAnalysisId("");
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none max-w-[200px]"
            >
              <option value="">Laboratoriya...</option>
              {(Array.isArray(laboratories) ? laboratories : []).map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select
              value={filterAnalysisId}
              disabled={!filterLabId}
              onChange={e => {
                const nextId = e.target.value;
                setFilterAnalysisId(nextId);
                if (!nextId) {
                  setEditorOpen(false);
                  return;
                }
                const analysisId = Number(nextId);
                const match = (Array.isArray(templates) ? templates : []).filter(
                  t => resolvePdfTemplateAnalysisId(t) === analysisId,
                );
                if (match.length === 0) {
                  setEditorOpen(false);
                  return;
                }
                const found = match[0];
                setTemplate(structuredClone(found));
                setSelectedId(null);
                setEditingId(null);
                setTableSel(null);
                setActiveTemplateId(found.id);
                setIsGlobalEditMode(false);
                setEditorOpen(true);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none max-w-[200px] disabled:opacity-60"
            >
              <option value="">
                {filterLabId ? "Analiz..." : "Avval laboratoriya"}
              </option>
              {filterLabAnalyses.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={
                editorOpen && filteredTemplates.some(t => t.id === template.id) ? template.id : ""
              }
              disabled={!filterAnalysisId}
              onChange={e => {
                if (e.target.value) handleLoad(e.target.value);
              }}
              className="bg-secondary border border-border rounded-xl px-3 py-2 text-[13px] text-foreground focus:outline-none max-w-[220px] disabled:opacity-60"
            >
              <option value="">
                {!filterAnalysisId
                  ? "Avval analiz tanlang"
                  : filteredTemplates.length === 0
                    ? "Shablon topilmadi"
                    : "Saqlangan shablonlar..."}
              </option>
              {filteredTemplates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleNew}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-secondary text-foreground hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" /> Yangi
            </button>
          </>
        )}
        {editorOpen && (
          <>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || savingGlobal || deleting}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold text-white disabled:opacity-50"
              style={{ background: primaryColor }}
            >
              {saving || (isGlobalEditMode && savingGlobal) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {isGlobalEditMode ? "Globalni saqlash" : "Saqlash"}
            </button>
            {!isGlobalEditMode && (
              <button
                type="button"
                onClick={() => void handleSaveGlobal()}
                disabled={saving || savingGlobal || deleting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-semibold border border-border bg-secondary text-foreground hover:opacity-90 disabled:opacity-50"
                title="Barcha tumanlar ko'ra oladigan global omborga saqlash"
              >
                {savingGlobal ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                Globalga saqlash
              </button>
            )}
            {!isGlobalEditMode && templates.some(t => t.id === template.id) && (
              <button
                type="button"
                onClick={() => setDeleteConfirmId(template.id)}
                disabled={saving || savingGlobal || deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-red-600 bg-red-500/10 hover:bg-red-500/15 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                O&apos;chirish
              </button>
            )}
          </>
        )}
        {!isGlobalEditMode && (
          <button
            type="button"
            onClick={() => void loadMeta()}
            className="p-2 rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMeta ? "animate-spin" : ""}`} />
          </button>
        )}
      </div>

      {editorOpen ? (
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
        {/* Tools + properties */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden max-h-[calc(100vh-200px)] flex flex-col">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <h3 className="text-[13px] font-semibold text-foreground">Instrumentlar</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tortib tashlang, keyin 1 marta bosing — qiymat berish
            </p>
          </div>

          <div className="overflow-y-auto ses-scrollbar flex-1">
            {/* Properties FIRST when selected so it's always visible */}
            {selected && (
              <div
                ref={propsPanelRef}
                className="p-4 border-b border-border space-y-3"
                style={{ background: `${primaryColor}08` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-[12px] font-semibold text-foreground">Tanlangan element</h4>
                    <p className="text-[10px] text-muted-foreground capitalize">{selected.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setElementDeleteId(selected.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10"
                    title="O'chirish"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {isTextual && (
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Matn *
                    </label>
                    <textarea
                      autoFocus
                      value={selected.content}
                      onChange={e => updateElement(selected.id, { content: e.target.value })}
                      rows={4}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none focus:border-[var(--primary)] resize-none"
                      placeholder="Matn kiriting..."
                    />
                  </div>
                )}

                {canStyleText && (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(
                        [
                          { key: "bold", icon: Bold },
                          { key: "italic", icon: Italic },
                          { key: "underline", icon: Underline },
                        ] as const
                      ).map(({ key, icon: Icon }) => {
                        const on = Boolean(selected.style?.[key]);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => updateStyle(selected.id, { [key]: !on })}
                            className={`p-2 rounded-lg border transition-colors ${
                              on
                                ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10"
                                : "border-border text-muted-foreground hover:text-foreground bg-card"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                      <span className="w-px h-5 bg-border mx-1" />
                      {(
                        [
                          { align: "left" as const, icon: AlignLeft },
                          { align: "center" as const, icon: AlignCenter },
                          { align: "right" as const, icon: AlignRight },
                        ]
                      ).map(({ align, icon: Icon }) => {
                        const on = (selected.style?.align || "left") === align;
                        return (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateStyle(selected.id, { align })}
                            className={`p-2 rounded-lg border transition-colors ${
                              on
                                ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/10"
                                : "border-border text-muted-foreground hover:text-foreground bg-card"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        );
                      })}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Shrift o&apos;lchami
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={48}
                        value={selected.style?.fontSize ?? 12}
                        onChange={e =>
                          updateStyle(selected.id, { fontSize: Number(e.target.value) || 12 })
                        }
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
                      />
                    </div>
                  </>
                )}

                {selected.type === "image" && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Rasm biriktirish *
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        applyImageFile(e.target.files?.[0] ?? null, selected.id);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-dashed text-[12px] font-semibold hover:border-[var(--primary)]"
                      style={{ borderColor: primaryColor, color: primaryColor, background: `${primaryColor}10` }}
                    >
                      <Upload className="w-4 h-4" />
                      {selected.imageSrc ? "Rasmni almashtirish" : "Rasm tanlash"}
                    </button>
                    {selected.imageSrc && (
                      <img
                        src={selected.imageSrc}
                        alt="Preview"
                        className="w-full max-h-28 object-contain rounded-lg border border-border bg-card"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Kenglik
                    </label>
                    <input
                      type="number"
                      min={40}
                      max={A4_WIDTH}
                      value={Math.round(selected.width)}
                      onChange={e => {
                        const width = Math.max(40, Math.min(A4_WIDTH - selected.x, Number(e.target.value) || 40));
                        updateElement(selected.id, { width });
                      }}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                      Balandlik
                    </label>
                    <input
                      type="number"
                      min={20}
                      max={A4_HEIGHT * PDF_MAX_PAGES}
                      value={Math.round(selected.height)}
                      onChange={e => {
                        const maxH = A4_HEIGHT * PDF_MAX_PAGES - selected.y;
                        const height = Math.max(20, Math.min(maxH, Number(e.target.value) || 20));
                        updateElement(selected.id, { height });
                      }}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
                    />
                  </div>
                </div>

                {selected.type === "dynamic" && (
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-muted-foreground">
                      Dinamik maydon
                    </label>
                    <select
                      value={selected.dynamicKey ?? ""}
                      onChange={e => {
                        const key = e.target.value as PdfDynamicFieldKey;
                        const def = getDynamicFieldDef(key);
                        updateElement(selected.id, {
                          dynamicKey: key,
                          content: def?.label ?? selected.content,
                          showDynamicLabel: def?.showLabelByDefault !== false,
                          ...(def?.defaultStyle
                            ? { style: { ...selected.style, ...def.defaultStyle } }
                            : {}),
                        });
                      }}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
                    >
                      {DYNAMIC_FIELDS.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <div>
                      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                        Yorliq matni
                      </label>
                      <input
                        value={selected.content}
                        onChange={e => updateElement(selected.id, { content: e.target.value })}
                        className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-[12px] text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.showDynamicLabel !== false}
                        onChange={e =>
                          updateElement(selected.id, { showDynamicLabel: e.target.checked })
                        }
                        className="rounded border-border"
                        style={{ accentColor: primaryColor }}
                      />
                      &quot;Yorliq: qiymat&quot; ko&apos;rinishi
                    </label>
                    <p className="text-[10px] text-rose-600 whitespace-pre-wrap">
                      Namuna: {getDynamicFieldDef(selected.dynamicKey)?.sample ?? "…"}
                    </p>
                  </div>
                )}

                {selected.type === "table" && (
                  <FreeTableBuilder
                    selected={selected}
                    analyses={analyses}
                    primaryColor={primaryColor}
                    selection={tableSel}
                    onSelectCell={handleSelectCell}
                    onClearSelection={() => setTableSel(null)}
                    onUpdate={patch => {
                      const td = normalizeTableData(patch.tableData ?? selected.tableData);
                      setTemplate(t => ({
                        ...t,
                        ...("analysisId" in patch
                          ? {
                              analysisId: patch.analysisId ?? null,
                              analysisName: patch.analysisName ?? "",
                            }
                          : null),
                        elements: t.elements.map(el =>
                          el.id === selected.id
                            ? {
                                ...el,
                                ...patch,
                                height: tableHeightForRows(td.headerRows, td.bodyRows),
                              }
                            : el,
                        ),
                      }));
                    }}
                    onTableData={setSelectedTableData}
                  />
                )}
              </div>
            )}

            <div className="p-3 space-y-2">
              {TOOLS.map(tool => {
                const Icon = tool.icon;
                return (
                  <div
                    key={tool.type}
                    draggable
                    onDragStart={e => {
                      const payload: DragPayload = { kind: "tool", type: tool.type };
                      e.dataTransfer.setData("application/x-pdf-tool", JSON.stringify(payload));
                      e.dataTransfer.effectAllowed = "copy";
                      setDragTool(payload);
                    }}
                    onDragEnd={() => setDragTool(null)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-secondary/60 cursor-grab active:cursor-grabbing hover:border-[var(--primary)] transition-colors"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${primaryColor}18`, color: primaryColor }}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-foreground">{tool.label}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{tool.hint}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-border shrink-0 bg-rose-500/5">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-rose-600" />
                <h3 className="text-[13px] font-semibold text-foreground">Dinamik ma&apos;lumotlar</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Qizil nuqtalangan maydonlar — natijada avtomatik to&apos;ldiriladi
              </p>
            </div>
            <div className="p-3 space-y-2 border-b border-border">
              {DYNAMIC_FIELDS.map(field => (
                <div
                  key={field.key}
                  draggable
                  onDragStart={e => {
                    const payload: DragPayload = { kind: "dynamic", key: field.key };
                    e.dataTransfer.setData("application/x-pdf-tool", JSON.stringify(payload));
                    e.dataTransfer.effectAllowed = "copy";
                    setDragTool(payload);
                  }}
                  onDragEnd={() => setDragTool(null)}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl border border-rose-200/80 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900 cursor-grab active:cursor-grabbing hover:border-rose-400 transition-colors"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-foreground truncate">{field.label}</div>
                    <div
                      className={`text-[10px] text-rose-600/90 ${
                        field.multiline ? "whitespace-pre-wrap line-clamp-3" : "truncate"
                      }`}
                    >
                      {field.sample} · {field.hint}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* A4 canvas (grows to 2–N pages when content overflows) */}
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">A4 ko&apos;rinishi</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Bosish — tahrirlash · burchak/tomon — o&apos;lcham · tortib ko&apos;chirish
                {pageCount > 1 ? ` · ${pageCount} sahifa` : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MousePointer2 className="w-3.5 h-3.5" />
              {template.elements.length} element
            </div>
          </div>

          <div className="p-4 md:p-6 overflow-auto ses-scrollbar bg-secondary/40 flex justify-center max-h-[calc(100vh-220px)]">
            <div
              ref={canvasRef}
              onDragOver={e => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={handleCanvasDrop}
              onMouseDown={e => {
                if (e.target === e.currentTarget) {
                  setSelectedId(null);
                  setEditingId(null);
                }
              }}
              className="relative bg-white shadow-xl border border-slate-200 shrink-0"
              style={{
                width: A4_PREVIEW_WIDTH,
                height: previewHeight,
              }}
            >
              {pageCount > 1 &&
                Array.from({ length: pageCount - 1 }, (_, i) => (
                  <div
                    key={`page-break-${i}`}
                    data-pdf-page-break=""
                    className="absolute left-0 right-0 z-40 pointer-events-none border-t-2 border-dashed border-teal-400/80"
                    style={{ top: (i + 1) * A4_PREVIEW_HEIGHT }}
                    aria-hidden
                  >
                    <span className="absolute right-2 -top-2.5 rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-semibold text-teal-700">
                      {i + 2}-sahifa
                    </span>
                  </div>
                ))}

              {template.elements.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center px-6">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-[13px] font-medium text-slate-400">
                      Instrumentlarni shu yerga tortib tashlang
                    </p>
                  </div>
                </div>
              )}

              {template.elements.map(el => (
                <CanvasElement
                  key={el.id}
                  element={el}
                  selected={selectedId === el.id}
                  editing={editingId === el.id}
                  primaryColor={primaryColor}
                  tableSel={selectedId === el.id ? tableSel : null}
                  onSelect={() => selectElement(el.id)}
                  onSelectHeaderCell={(row, col, shiftKey) => {
                    selectElement(el.id, { keepTableSel: true });
                    handleSelectCell("header", row, col, shiftKey);
                  }}
                  onSelectBodyCell={(row, col, shiftKey) => {
                    selectElement(el.id, { keepTableSel: true });
                    handleSelectCell("body", row, col, shiftKey);
                  }}
                  onTableDataChange={data => {
                    const td = normalizeTableData(data);
                    updateElement(el.id, {
                      tableData: td,
                      height: tableHeightForRows(td.headerRows, td.bodyRows),
                    });
                  }}
                  onStartEdit={() => {
                    setSelectedId(el.id);
                    if (el.type === "image") {
                      fileInputRef.current?.click();
                    } else if (el.type !== "table" && el.type !== "dynamic") {
                      setEditingId(el.id);
                    }
                  }}
                  onContentChange={content => updateElement(el.id, { content })}
                  onEndEdit={() => setEditingId(null)}
                  onDrag={handleElementDrag}
                  onResize={handleElementResize}
                  onRemove={() => setElementDeleteId(el.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-10 text-center">
          <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-[14px] font-semibold text-foreground mb-1">
            Shablon muharriri yopiq
          </p>
          <p className="text-[12px] text-muted-foreground max-w-md mx-auto">
            Instrumentlar va A4 ko&apos;rinishi <strong>+ Yangi</strong> tugmasi orqali
            ochiladi. Yoki yuqoridan laboratoriya → analiz → saqlangan shablonni tanlang.
          </p>
          <button
            type="button"
            onClick={handleNew}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white"
            style={{ background: primaryColor }}
          >
            <Plus className="w-4 h-4" /> Yangi shablon
          </button>
        </div>
      )}

      <div className="fixed bottom-5 right-5 z-[60] space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12px] font-medium text-white animate-fade-in ${
              t.type === "success" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {t.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {t.text}
            <button type="button" onClick={() => setToasts(list => list.filter(x => x.id !== t.id))} className="ml-1 opacity-80">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {loadingMeta && (
        <div className="fixed bottom-5 left-5 z-[60] flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shadow text-[12px] text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ma&apos;lumotlar yuklanmoqda...
        </div>
      )}

      {newModalOpen && (
        <NewTemplateModal
          laboratories={laboratories}
          analyses={analyses}
          primaryColor={primaryColor}
          onConfirm={handleConfirmNew}
          onClose={() => setNewModalOpen(false)}
        />
      )}

      {pendingImport && (
        <NewTemplateModal
          laboratories={laboratories}
          analyses={analyses}
          primaryColor={primaryColor}
          title="Global shablonni o'ziga moslashtirish"
          description="Qaysi laboratoriya va analiz uchun online storage'ga saqlashni tanlang"
          confirmLabel="Tahrirlashni ochish"
          initialAnalysisId={
            analyses.some(a => a.id === pendingImport.analysisId)
              ? pendingImport.analysisId
              : null
          }
          onConfirm={handleConfirmImport}
          onClose={handleCancelImport}
        />
      )}

      {deleteConfirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteConfirmId(null)}
          />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">Shablonni o&apos;chirish</h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">
                  {deleteConfirmTarget.name || "Nomsiz shablon"}
                </span>
                {" "}ni o&apos;chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteTemplate()}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Ha, o&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}

      {elementDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setElementDeleteId(null)}
          />
          <div className="relative bg-card rounded-3xl border border-border shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-[16px] font-bold text-foreground mb-2">
                Elementni o&apos;chirish
              </h2>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Tanlangan elementni o&apos;chirishni xohlaysizmi?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setElementDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-secondary transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmRemoveElement}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-[0.98]"
              >
                Ha, o&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FreeTableBuilder({
  selected,
  analyses,
  primaryColor,
  selection,
  onSelectCell,
  onClearSelection,
  onUpdate,
  onTableData,
}: {
  selected: PdfElement;
  analyses: Analysis[];
  primaryColor: string;
  selection: PdfTableSelection | null;
  onSelectCell: (
    section: "header" | "body",
    row: number,
    col: number,
    shiftKey: boolean,
  ) => void;
  onClearSelection: () => void;
  onUpdate: (patch: Partial<PdfElement>) => void;
  onTableData: (data: PdfTableData) => void;
}) {
  const data = normalizeTableData(selected.tableData);
  const bounds = selection ? normalizeSelection(selection) : null;
  const section = bounds?.section ?? "header";
  const grid = section === "body" ? data.bodyCells : data.headerCells;
  const active =
    bounds &&
    bounds.r1 === bounds.r2 &&
    bounds.c1 === bounds.c2 &&
    !grid[bounds.r1]?.[bounds.c1]?.covered
      ? { row: bounds.r1, col: bounds.c1 }
      : bounds
        ? { row: bounds.r1, col: bounds.c1 }
        : null;
  const activeCellRaw = active ? grid[active.row]?.[active.col] : undefined;
  const activeCell = activeCellRaw && !activeCellRaw.covered ? activeCellRaw : null;
  const canMerge = Boolean(
    bounds && (bounds.r1 !== bounds.r2 || bounds.c1 !== bounds.c2),
  );

  const applyMerge = () => {
    if (!bounds) return;
    onTableData(
      bounds.section === "body"
        ? mergeBodySelection(data, bounds)
        : mergeHeaderSelection(data, bounds),
    );
  };

  const applyUnmerge = () => {
    if (!bounds) return;
    onTableData(
      bounds.section === "body"
        ? unmergeBodySelection(data, bounds)
        : unmergeHeaderSelection(data, bounds),
    );
  };

  const patchActiveCell = (patch: Partial<PdfTableCell>) => {
    if (!active || !bounds) return;
    onTableData(
      bounds.section === "body"
        ? updateBodyCell(data, active.row, active.col, patch)
        : updateHeaderCell(data, active.row, active.col, patch),
    );
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Har bir katakning o&apos;ngidagi ▾ tugmasi:{" "}
        <strong>O&apos;zgarmaydigan</strong> — faqat shu yerda tahrir;{" "}
        <strong>O&apos;zgaradigan</strong> — Natijalar sahifasida to&apos;ldiriladi.
        Ustun kengligini jadvalda tortib o&apos;zgartirish mumkin.
      </p>

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
          Analiz bog&apos;lash
        </label>
        <select
          value={selected.analysisId ?? ""}
          onChange={e => {
            const id = e.target.value ? Number(e.target.value) : null;
            const a = analyses.find(x => x.id === id);
            onUpdate({
              analysisId: id,
              analysisName: a?.name ?? "",
            });
          }}
          className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
        >
          <option value="">Tanlang...</option>
          {(Array.isArray(analyses) ? analyses : []).map(a => (
            <option key={a.id} value={a.id}>
              {a.name} {a.laboratory?.name ? `(${a.laboratory.name})` : ""}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground mt-1">
          Saqlashda `/onlinestorage` analysis_id sifatida yuboriladi
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Ustunlar
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTableData(resizeTableCols(data, data.cols - 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-center text-[13px] font-semibold tabular-nums">
              {data.cols}
            </span>
            <button
              type="button"
              onClick={() => onTableData(resizeTableCols(data, data.cols + 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Header
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTableData(resizeHeaderRows(data, data.headerRows - 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-center text-[13px] font-semibold tabular-nums">
              {data.headerRows}
            </span>
            <button
              type="button"
              onClick={() => onTableData(resizeHeaderRows(data, data.headerRows + 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            Body
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onTableData(resizeBodyRows(data, data.bodyRows - 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="flex-1 text-center text-[13px] font-semibold tabular-nums">
              {data.bodyRows}
            </span>
            <button
              type="button"
              onClick={() => onTableData(resizeBodyRows(data, data.bodyRows + 1))}
              className="p-2 rounded-lg border border-border hover:bg-secondary"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-muted-foreground mb-1.5">
          Ustun kengliklari (%)
        </label>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(data.cols, 4)}, minmax(0, 1fr))` }}>
          {data.colWidths.map((w, i) => (
            <label key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="shrink-0 w-4">{i + 1}</span>
              <input
                type="number"
                min={5}
                max={90}
                step={1}
                value={Math.round(w)}
                onChange={e => {
                  const pct = Number(e.target.value);
                  if (!Number.isFinite(pct)) return;
                  onTableData(setColWidthAt(data, i, pct));
                }}
                className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-[12px] text-foreground tabular-nums focus:outline-none"
              />
            </label>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Yoki jadvalda ustun chegarasini torting
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canMerge}
          onClick={applyMerge}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl border border-border text-[11px] font-semibold disabled:opacity-40 hover:bg-secondary"
          style={canMerge ? { borderColor: primaryColor, color: primaryColor } : undefined}
        >
          <Combine className="w-3.5 h-3.5" /> Birlashtirish
        </button>
        <button
          type="button"
          disabled={!selection}
          onClick={applyUnmerge}
          className="flex-1 py-2 rounded-xl border border-border text-[11px] font-semibold disabled:opacity-40 hover:bg-secondary"
        >
          Ajratish
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Header yoki body katakni tanlang, <kbd className="px-1 rounded bg-secondary">Shift</kbd>
        +bosib diapazonni kengaytiring, so&apos;ng Birlashtirish.
      </p>

      {activeCell && active && bounds && (
        <div className="rounded-xl border border-border bg-secondary/50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-foreground">
              {bounds.section === "body" ? "Body" : "Header"} katak [{active.row + 1},{" "}
              {active.col + 1}]
              {(activeCell.colSpan ?? 1) > 1 || (activeCell.rowSpan ?? 1) > 1
                ? ` · ${activeCell.rowSpan ?? 1}×${activeCell.colSpan ?? 1}`
                : ""}
            </p>
            <button
              type="button"
              onClick={onClearSelection}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Bekor
            </button>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => patchActiveCell({ valueMode: "static" })}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border ${
                (activeCell.valueMode ?? "static") !== "dynamic"
                  ? "border-foreground/30 bg-card text-foreground"
                  : "border-border text-muted-foreground hover:bg-card"
              }`}
            >
              O&apos;zgarmaydigan
            </button>
            <button
              type="button"
              onClick={() => patchActiveCell({ valueMode: "dynamic" })}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-semibold border ${
                activeCell.valueMode === "dynamic"
                  ? "border-amber-500/50 bg-amber-50 text-amber-800"
                  : "border-border text-muted-foreground hover:bg-card"
              }`}
            >
              O&apos;zgaradigan
            </button>
          </div>
          {(activeCell.valueMode ?? "static") !== "dynamic" ? (
            <input
              value={activeCell.text}
              onChange={e => patchActiveCell({ text: e.target.value })}
              onFocus={() => onSelectCell(bounds.section, active.row, active.col, false)}
              placeholder="Katak matni..."
              className="w-full bg-card border border-border rounded-xl px-3 py-2 text-[12px] text-foreground focus:outline-none"
            />
          ) : (
            <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-2">
              O&apos;zgaradigan — matn Natijalar sahifasida kiritiladi
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          onTableData(createEmptyTableData(4, 1, 3));
          onClearSelection();
        }}
        className="w-full text-[11px] font-medium py-2 rounded-xl border border-dashed border-border text-muted-foreground hover:text-foreground"
      >
        Jadvalni tozalash (4×1 header, 3 body)
      </button>
    </div>
  );
}

function CanvasElement({
  element,
  selected,
  editing,
  primaryColor,
  tableSel,
  onSelect,
  onSelectHeaderCell,
  onSelectBodyCell,
  onTableDataChange,
  onStartEdit,
  onContentChange,
  onEndEdit,
  onDrag,
  onResize,
  onRemove,
}: {
  element: PdfElement;
  selected: boolean;
  editing: boolean;
  primaryColor: string;
  tableSel: PdfTableSelection | null;
  onSelect: () => void;
  onSelectHeaderCell: (row: number, col: number, shiftKey: boolean) => void;
  onSelectBodyCell: (row: number, col: number, shiftKey: boolean) => void;
  onTableDataChange: (data: PdfTableData) => void;
  onStartEdit: () => void;
  onContentChange: (content: string) => void;
  onEndEdit: () => void;
  onDrag: (id: string, dx: number, dy: number) => void;
  onResize: (id: string, next: { x: number; y: number; width: number; height: number }) => void;
  onRemove: () => void;
}) {
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const resizeRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (editing || resizeRef.current) return;
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (resizeRef.current) {
      const r = resizeRef.current;
      const dx = (e.clientX - r.startX) / A4_PREVIEW_SCALE;
      const dy = (e.clientY - r.startY) / A4_PREVIEW_SCALE;
      onResize(element.id, applyResize(r.handle, r.origX, r.origY, r.origW, r.origH, dx, dy));
      return;
    }
    if (!dragRef.current || editing) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragRef.current.moved = true;
    dragRef.current = { x: e.clientX, y: e.clientY, moved: dragRef.current.moved };
    if (dragRef.current.moved) onDrag(element.id, dx, dy);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasClick = dragRef.current && !dragRef.current.moved;
    dragRef.current = null;
    resizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (wasClick) onSelect();
  };

  const startResize = (handle: ResizeHandle, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: element.x,
      origY: element.y,
      origW: element.width,
      origH: element.height,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const r = resizeRef.current;
    const dx = (e.clientX - r.startX) / A4_PREVIEW_SCALE;
    const dy = (e.clientY - r.startY) / A4_PREVIEW_SCALE;
    onResize(element.id, applyResize(r.handle, r.origX, r.origY, r.origW, r.origH, dx, dy));
  };

  const onResizePointerUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const textStyle: React.CSSProperties = {
    fontWeight: element.style?.bold ? 700 : 400,
    fontStyle: element.style?.italic ? "italic" : "normal",
    textDecoration: element.style?.underline ? "underline" : "none",
    fontSize: (element.style?.fontSize ?? 12) * A4_PREVIEW_SCALE,
    textAlign: element.style?.align || "left",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    color: "#0f172a",
    lineHeight: 1.35,
    width: "100%",
    height: "100%",
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={e => {
        e.stopPropagation();
        onStartEdit();
      }}
      onClick={e => {
        e.stopPropagation();
        onSelect();
      }}
      className={`absolute select-none group ${editing ? "cursor-text" : "cursor-move"} ${
        selected ? "z-20" : "hover:outline hover:outline-1 hover:outline-slate-300 z-10"
      }`}
      style={{
        left: element.x * A4_PREVIEW_SCALE,
        top: element.y * A4_PREVIEW_SCALE,
        width: element.width * A4_PREVIEW_SCALE,
        height: element.height * A4_PREVIEW_SCALE,
        outline: selected ? `2px solid ${primaryColor}` : undefined,
        outlineOffset: selected ? 2 : undefined,
      }}
    >
      {selected && !editing && (
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow z-40"
          style={{ top: -26, right: -4 }}
          title="O'chirish"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {selected && !editing &&
        RESIZE_HANDLES.map(h => (
          <div
            key={h}
            onPointerDown={e => startResize(h, e)}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            className="absolute z-30 bg-white border-2 shadow-sm"
            style={{
              ...handleStyle(h),
              borderColor: primaryColor,
              width: CORNER_HANDLES.includes(h) ? 10 : h === "n" || h === "s" ? 18 : 10,
              height: CORNER_HANDLES.includes(h) ? 10 : h === "e" || h === "w" ? 18 : 10,
              borderRadius: CORNER_HANDLES.includes(h) ? 2 : 3,
            }}
            title="O'lchamni o'zgartirish"
          />
        ))}

      <div className="w-full h-full overflow-hidden">
        {element.type === "image" ? (
          element.imageSrc ? (
            <img
              src={element.imageSrc}
              alt=""
              className="w-full h-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div
              className="w-full h-full min-h-[80px] border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-400 bg-slate-50"
              style={selected ? { borderColor: primaryColor, color: primaryColor } : undefined}
            >
              <ImageIcon className="w-5 h-5" />
              Rasm tanlang (chap panel)
            </div>
          )
      ) : element.type === "table" ? (
        <div className="w-full h-full bg-white overflow-auto" onPointerDown={e => e.stopPropagation()}>
          <CustomPdfTable
            data={normalizeTableData(element.tableData)}
            showValueModeMenu={selected}
            editableHeader={selected}
            editableBody={selected}
            selection={tableSel}
            onSelectHeaderCell={(row, col, shiftKey) => {
              onSelectHeaderCell(row, col, shiftKey);
            }}
            onSelectBodyCell={(row, col, shiftKey) => {
              onSelectBodyCell(row, col, shiftKey);
            }}
            onChangeHeaderCell={(row, col, patch) => {
              onTableDataChange(
                updateHeaderCell(normalizeTableData(element.tableData), row, col, patch),
              );
            }}
            onChangeBodyCell={(row, col, patch) => {
              onTableDataChange(
                updateBodyCell(normalizeTableData(element.tableData), row, col, patch),
              );
            }}
            resizableColumns={selected}
            onColWidthsChange={widths => {
              onTableDataChange(
                updateColWidths(normalizeTableData(element.tableData), widths),
              );
            }}
            compact
          />
        </div>
      ) : element.type === "dynamic" ? (
        <DynamicFieldPreview element={element} style={textStyle} />
      ) : editing ? (
          <textarea
            ref={textareaRef}
            value={element.content}
            onChange={e => onContentChange(e.target.value)}
            onBlur={onEndEdit}
            onPointerDown={e => e.stopPropagation()}
            onKeyDown={e => {
              if (e.key === "Escape") onEndEdit();
            }}
            className="w-full h-full bg-teal-50/80 border border-teal-400 rounded-sm px-1 py-0.5 resize-none outline-none"
            style={textStyle}
          />
        ) : (
          <div style={textStyle}>{element.content || " "}</div>
        )}
      </div>
    </div>
  );
}

function DynamicFieldPreview({
  element,
  style,
}: {
  element: PdfElement;
  style: React.CSSProperties;
}) {
  const { label, value } = formatDynamicDisplay(element, null, true);
  const showLabel = element.showDynamicLabel !== false;
  const multiline = Boolean(getDynamicFieldDef(element.dynamicKey)?.multiline);
  if (multiline) {
    return (
      <div style={style} className="w-full h-full overflow-hidden">
        {showLabel && label ? <div className="text-slate-800">{label}:</div> : null}
        <div className="text-rose-600 font-medium whitespace-pre-wrap underline decoration-rose-300 decoration-dotted underline-offset-2">
          {value}
        </div>
      </div>
    );
  }
  return (
    <div style={style} className="flex items-baseline gap-1 w-full overflow-hidden">
      {showLabel && label ? (
        <span className="shrink-0 text-slate-800">{label}:</span>
      ) : null}
      <span className="inline-flex items-center gap-1 min-w-0">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
        <span className="text-rose-600 font-medium truncate underline decoration-rose-300 decoration-dotted underline-offset-2">
          {value}
        </span>
      </span>
    </div>
  );
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const RESIZE_HANDLES: ResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CORNER_HANDLES: ResizeHandle[] = ["nw", "ne", "se", "sw"];

const MIN_W = 40;
const MIN_H = 20;

function handleStyle(h: ResizeHandle): React.CSSProperties {
  const base: React.CSSProperties = { position: "absolute" };
  switch (h) {
    case "nw":
      return { ...base, left: -5, top: -5, cursor: "nwse-resize" };
    case "n":
      return { ...base, left: "50%", top: -5, transform: "translateX(-50%)", cursor: "ns-resize" };
    case "ne":
      return { ...base, right: -5, top: -5, cursor: "nesw-resize" };
    case "e":
      return { ...base, right: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
    case "se":
      return { ...base, right: -5, bottom: -5, cursor: "nwse-resize" };
    case "s":
      return { ...base, left: "50%", bottom: -5, transform: "translateX(-50%)", cursor: "ns-resize" };
    case "sw":
      return { ...base, left: -5, bottom: -5, cursor: "nesw-resize" };
    case "w":
      return { ...base, left: -5, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" };
  }
}

function applyResize(
  handle: ResizeHandle,
  origX: number,
  origY: number,
  origW: number,
  origH: number,
  dx: number,
  dy: number,
): { x: number; y: number; width: number; height: number } {
  let x = origX;
  let y = origY;
  let width = origW;
  let height = origH;

  const affectsLeft = handle === "w" || handle === "nw" || handle === "sw";
  const affectsRight = handle === "e" || handle === "ne" || handle === "se";
  const affectsTop = handle === "n" || handle === "nw" || handle === "ne";
  const affectsBottom = handle === "s" || handle === "sw" || handle === "se";

  if (affectsRight) {
    width = Math.max(MIN_W, origW + dx);
  }
  if (affectsBottom) {
    height = Math.max(MIN_H, origH + dy);
  }
  if (affectsLeft) {
    const nextW = Math.max(MIN_W, origW - dx);
    const usedDx = origW - nextW;
    x = origX + usedDx;
    width = nextW;
  }
  if (affectsTop) {
    const nextH = Math.max(MIN_H, origH - dy);
    const usedDy = origH - nextH;
    y = origY + usedDy;
    height = nextH;
  }

  // Keep width inside A4; height may span multiple pages
  const maxDocH = A4_HEIGHT * PDF_MAX_PAGES;
  if (x < 0) {
    width += x;
    x = 0;
  }
  if (y < 0) {
    height += y;
    y = 0;
  }
  if (x + width > A4_WIDTH) width = A4_WIDTH - x;
  if (y + height > maxDocH) height = maxDocH - y;

  width = Math.max(MIN_W, width);
  height = Math.max(MIN_H, height);

  return { x, y, width, height };
}
