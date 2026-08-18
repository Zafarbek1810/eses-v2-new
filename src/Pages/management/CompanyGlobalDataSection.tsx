import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, X, RefreshCw, FlaskConical, TestTube2, FileType,
  CheckCircle, AlertCircle, Loader2, Database, Eye, Trash2,
  ChevronLeft, ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { ResultPdfCanvas } from "@/components/ResultPdfCanvas";
import { getAllBaseLaboratories, type BaseLaboratory } from "@/api/baseLaboratory";
import { getAllBaseAnalyses, type BaseAnalysis } from "@/api/baseAnalysis";
import {
  getAllGlobalStorages,
  getGlobalStorageById,
  resolveGlobalStorageAnalysisId,
  type GlobalStorage,
} from "@/api/globalStorage";
import {
  addLaboratory,
  deleteLaboratory,
  getAllLaboratories,
  getLaboratoriesFull,
  type Laboratory,
} from "@/api/laboratory";
import {
  addAnalysis,
  deleteAnalysis,
  getAllAnalyses,
  getAnalysesFull,
  type Analysis,
} from "@/api/analysis";
import { deleteOnlineStorage, getAllOnlineStorages, resolveOnlineStorageAnalysisId } from "@/api/onlineStorage";
import { getCompanyById, type Company } from "@/api/company";
import { ApiError } from "@/api/client";
import { formatDate } from "@/lib/formatDate";
import {
  ensureCompanyPdfTemplatesFromGlobal,
  globalStorageRecordToPdfTemplate,
  globalTemplateMatchesAnalyses,
  hydrateGlobalStorageRecords,
  remapGlobalTemplateToAnalysis,
  upsertPdfTemplateRemote,
  type PdfTemplate,
} from "@/lib/pdfTemplate";

type ToastMsg = { id: number; text: string; type: "success" | "error" };

type CatalogRow = {
  lab: Laboratory;
  analyses: Analysis[];
  templates: { id: number; name: string; analysisName: string; analysisId: number }[];
};

const PER_PAGE = 10;

function extractId(raw: unknown): number | null {
  const fromValue = (value: unknown): number | null => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const direct = fromValue(raw);
  if (direct) return direct;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  for (const nested of [obj.data, obj.laboratory, obj.analysis, obj.item, obj.result]) {
    if (nested && typeof nested === "object") {
      const id = fromValue((nested as Record<string, unknown>).id);
      if (id) return id;
    }
  }
  return fromValue(obj.id);
}

function laboratoryCompanyId(lab: Laboratory): number | null {
  const value = lab.company?.id ?? lab.company_id ?? lab.companyId;
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function unwrapCompany(company: Company): Company {
  if (typeof company?.id === "number" && Number.isFinite(company.id) && company.id > 0) {
    return company;
  }
  const raw = company as Company & { data?: unknown; company?: unknown };
  const nested = [raw.data, raw.company].find(
    item => item && typeof item === "object" && !Array.isArray(item) && "id" in (item as object),
  );
  return nested ? nested as Company : company;
}

function companyLaboratories(company: Company): Laboratory[] {
  const raw = unwrapCompany(company) as Company & {
    laboratory?: unknown;
    laboratories?: unknown;
    labs?: unknown;
  };
  const candidate = raw.laboratory ?? raw.laboratories ?? raw.labs;
  if (!Array.isArray(candidate)) return [];
  return candidate.filter((lab): lab is Laboratory => {
    const id = Number((lab as Laboratory | null)?.id);
    return Number.isFinite(id) && id > 0;
  }).map(lab => ({ ...lab, id: Number(lab.id) }));
}

function resolveCompanyLaboratories(
  allLabs: Laboratory[],
  company: Company,
  companyId: number,
): Laboratory[] {
  const map = new Map<number, Laboratory>();
  const add = (lab: Laboratory | null | undefined) => {
    if (!lab) return;
    const id = Number(lab.id);
    if (!Number.isFinite(id) || id <= 0) return;
    const cid = laboratoryCompanyId(lab);
    if (cid != null && cid !== companyId) return;
    map.set(id, {
      ...lab,
      id,
      company_id: cid ?? companyId,
      companyId: cid ?? companyId,
      company: lab.company ?? { id: companyId },
    });
  };

  (Array.isArray(allLabs) ? allLabs : []).forEach(add);
  companyLaboratories(company).forEach(add);

  return [...map.values()];
}

function analysisLabId(item: Analysis): number | null {
  const id = Number(item.laboratory?.id ?? (item as Analysis & { laboratory_id?: number }).laboratory_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function analysisFromLabNested(raw: unknown, lab: Laboratory): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    name: String(o.name ?? ""),
    shortname: String(o.shortname ?? o.shortName ?? ""),
    price: String(o.price ?? "0"),
    createdAt: String(o.createdAt ?? o.created_at ?? ""),
    laboratory: {
      id: lab.id,
      name: lab.name,
      createdAt: lab.createdAt,
      lab_director: lab.lab_director,
    },
  };
}

function normName(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function baseAnalysisLabId(item: BaseAnalysis): number | null {
  const id = Number(item.baselaboratory?.id ?? item.baselaboratory_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function templateMatchesAnalyses(item: GlobalStorage, analyses: BaseAnalysis[]): boolean {
  return globalTemplateMatchesAnalyses(item, analyses);
}

function identityKeys(name: string | null | undefined, ...analysisNames: Array<string | null | undefined>): string[] {
  const itemName = normName(name);
  if (!itemName) return [];
  const keys = [itemName];
  for (const analysisName of analysisNames) {
    const a = normName(analysisName);
    if (a) keys.push(`${a}::${itemName}`);
  }
  return keys;
}

function hasAnyKey(keys: string[], existing: Set<string>): boolean {
  return keys.some(key => existing.has(key));
}

function remapTemplateToAnalysis(
  template: PdfTemplate,
  analysisId: number,
  analysisName: string,
  companyId: number,
): PdfTemplate {
  return remapGlobalTemplateToAnalysis(template, analysisId, analysisName, companyId);
}

function AddGlobalDataModal({
  primaryColor,
  saving,
  existingLabNames,
  existingAnalysisKeys,
  existingTemplateKeys,
  onSave,
  onClose,
}: {
  primaryColor: string;
  saving: boolean;
  existingLabNames: Set<string>;
  existingAnalysisKeys: Set<string>;
  existingTemplateKeys: Set<string>;
  onSave: (payload: {
    groups: Array<{
      lab: BaseLaboratory;
      analyses: BaseAnalysis[];
      templates: GlobalStorage[];
    }>;
  }) => void;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labs, setLabs] = useState<BaseLaboratory[]>([]);
  const [analyses, setAnalyses] = useState<BaseAnalysis[]>([]);
  const [templates, setTemplates] = useState<GlobalStorage[]>([]);
  const [labQuery, setLabQuery] = useState("");
  const [analysisQuery, setAnalysisQuery] = useState("");
  const [templateQuery, setTemplateQuery] = useState("");
  const [selectedLabIds, setSelectedLabIds] = useState<Set<number>>(new Set());
  const [selectedAnalysisIds, setSelectedAnalysisIds] = useState<Set<number>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<number>>(new Set());
  const [previewTemplate, setPreviewTemplate] = useState<PdfTemplate | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const [labList, analysisList, templateList] = await Promise.all([
          getAllBaseLaboratories(),
          getAllBaseAnalyses(),
          getAllGlobalStorages(),
        ]);
        if (cancelled) return;
        const nextLabs = Array.isArray(labList) ? labList : [];
        const nextAnalyses = Array.isArray(analysisList) ? analysisList : [];
        const nextTemplatesRaw = Array.isArray(templateList) ? templateList : [];
        const nextTemplates = await hydrateGlobalStorageRecords(nextTemplatesRaw);
        if (cancelled) return;
        const labNameById = new Map(nextLabs.map(lab => [lab.id, lab.name]));

        const nextLabIds = new Set(
          nextLabs.filter(lab => existingLabNames.has(normName(lab.name))).map(lab => lab.id),
        );
        const nextAnalysisIds = new Set(
          nextAnalyses.filter(item => {
            const labName = labNameById.get(baseAnalysisLabId(item) ?? -1) ?? "";
            return existingAnalysisKeys.has(`${normName(labName)}::${normName(item.name)}`);
          }).map(item => item.id),
        );
        const selectedAnalysesNow = nextAnalyses.filter(item => nextAnalysisIds.has(item.id));
        const nextTemplateIds = new Set(
          nextTemplates.filter(item => {
            const keys = identityKeys(item.name, item.baseanalysis?.name, item.analysis?.name);
            if (hasAnyKey(keys, existingTemplateKeys)) return true;
            return existingTemplateKeys.size > 0
              && templateMatchesAnalyses(item, selectedAnalysesNow)
              && existingTemplateKeys.has(normName(item.name));
          }).map(item => item.id),
        );

        setLabs(nextLabs);
        setAnalyses(nextAnalyses);
        setTemplates(nextTemplates);
        setSelectedLabIds(nextLabIds);
        setSelectedAnalysisIds(nextAnalysisIds);
        setSelectedTemplateIds(nextTemplateIds);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Global ma'lumotlarni yuklab bo'lmadi");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredLabs = useMemo(() => {
    const q = labQuery.trim().toLowerCase();
    return labs.filter(lab => !q || lab.name.toLowerCase().includes(q));
  }, [labs, labQuery]);

  const labById = useMemo(() => new Map(labs.map(lab => [lab.id, lab])), [labs]);

  const labAnalyses = useMemo(() => {
    if (selectedLabIds.size === 0) return [];
    const q = analysisQuery.trim().toLowerCase();
    return analyses
      .filter(item => {
        const labId = baseAnalysisLabId(item);
        if (labId == null || !selectedLabIds.has(labId)) return false;
        return !q
          || item.name.toLowerCase().includes(q)
          || item.shortname.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const labA = labById.get(baseAnalysisLabId(a) ?? -1)?.name ?? "";
        const labB = labById.get(baseAnalysisLabId(b) ?? -1)?.name ?? "";
        return labA.localeCompare(labB, "uz") || a.name.localeCompare(b.name, "uz");
      });
  }, [analyses, selectedLabIds, analysisQuery, labById]);

  const selectedLabs = useMemo(
    () => labs.filter(lab => selectedLabIds.has(lab.id)),
    [labs, selectedLabIds],
  );

  const selectedAnalyses = useMemo(
    () => analyses.filter(item => {
      const labId = baseAnalysisLabId(item);
      return selectedAnalysisIds.has(item.id) && labId != null && selectedLabIds.has(labId);
    }),
    [analyses, selectedAnalysisIds, selectedLabIds],
  );

  const matchingTemplates = useMemo(() => {
    const q = templateQuery.trim().toLowerCase();
    return templates.filter(item => {
      if (!templateMatchesAnalyses(item, selectedAnalyses)) return false;
      return !q
        || item.name.toLowerCase().includes(q)
        || (item.analysis?.name ?? "").toLowerCase().includes(q);
    });
  }, [templates, selectedAnalyses, templateQuery]);

  const selectedMatchingTemplates = useMemo(
    () => templates.filter(item =>
      selectedTemplateIds.has(item.id) && templateMatchesAnalyses(item, selectedAnalyses),
    ),
    [templates, selectedTemplateIds, selectedAnalyses],
  );

  useEffect(() => {
    if (selectedAnalyses.length === 0) return;
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const item of templates) {
        if (next.has(item.id) || !templateMatchesAnalyses(item, selectedAnalyses)) continue;
        next.add(item.id);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [selectedAnalyses, templates]);

  const toggleLab = (labId: number) => {
    setSelectedLabIds(prev => {
      const next = new Set(prev);
      if (next.has(labId)) next.delete(labId);
      else next.add(labId);
      return next;
    });
  };

  const toggleAllLabs = () => {
    const visibleIds = filteredLabs.map(lab => lab.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedLabIds.has(id));
    const next = new Set(selectedLabIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedLabIds(next);
  };

  const toggleAnalysis = (id: number) => {
    setSelectedAnalysisIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAnalyses = () => {
    const visibleIds = labAnalyses.map(item => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedAnalysisIds.has(id));
    const next = new Set(selectedAnalysisIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedAnalysisIds(next);
  };

  const toggleTemplate = (id: number) => {
    setSelectedTemplateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openTemplatePreview = async (item: GlobalStorage) => {
    setPreviewTitle(item.name);
    setPreviewTemplate(null);
    setPreviewError(null);
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewLoadingId(item.id);
    try {
      const full = await getGlobalStorageById(item.id);
      const tpl = globalStorageRecordToPdfTemplate(full) ?? globalStorageRecordToPdfTemplate(item);
      if (!tpl) {
        setPreviewError("Shablon ma'lumotini o'qib bo'lmadi");
        return;
      }
      setPreviewTemplate(tpl);
    } catch (err) {
      setPreviewError(err instanceof ApiError ? err.message : "PDF shablonni yuklab bo'lmadi");
    } finally {
      setPreviewLoading(false);
      setPreviewLoadingId(null);
    }
  };

  const closeTemplatePreview = () => {
    setPreviewOpen(false);
    setPreviewTemplate(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewLoadingId(null);
  };

  const toggleAllTemplates = () => {
    const visibleIds = matchingTemplates.map(item => item.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedTemplateIds.has(id));
    const next = new Set(selectedTemplateIds);
    if (allSelected) visibleIds.forEach(id => next.delete(id));
    else visibleIds.forEach(id => next.add(id));
    setSelectedTemplateIds(next);
  };

  const canSave = selectedLabs.length > 0 && selectedAnalyses.length > 0 && !saving;

  const buildSaveGroups = () => {
    const usedTemplateIds = new Set<number>();
    const isExisting = (item: GlobalStorage) =>
      hasAnyKey(identityKeys(item.name, item.baseanalysis?.name, item.analysis?.name), existingTemplateKeys);

    const groups = selectedLabs.map(lab => {
      const labSelectedAnalyses = selectedAnalyses.filter(item => baseAnalysisLabId(item) === lab.id);
      const labTemplates = templates.filter(item => {
        if (!selectedTemplateIds.has(item.id) || isExisting(item)) return false;
        return templateMatchesAnalyses(item, labSelectedAnalyses);
      });
      labTemplates.forEach(item => usedTemplateIds.add(item.id));
      return {
        lab,
        analyses: labSelectedAnalyses,
        templates: labTemplates,
      };
    }).filter(group => group.analyses.length > 0);

    const leftovers = templates.filter(item =>
      selectedTemplateIds.has(item.id) && !usedTemplateIds.has(item.id) && !isExisting(item),
    );
    if (leftovers.length > 0 && groups.length > 0) {
      groups[0] = { ...groups[0], templates: [...groups[0].templates, ...leftovers] };
    }
    return groups;
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-5 shrink-0">
          <div>
            <h2 className="text-[15px] font-semibold text-foreground">Ma'lumot qo'shish</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {existingLabNames.size > 0
                ? "Tashkilotdagi ma'lumotlar tanlangan. Yangilarini qo'shishingiz yoki o'zgartirishingiz mumkin"
                : "Global laboratoriya, analiz va PDF shablonlarni tanlab tashkilotga biriktiring"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs leading-relaxed text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-hidden p-6 max-lg:grid-cols-1 max-lg:overflow-y-auto">
          <PickerColumn
            title="Global laboratoriyalar"
            icon={FlaskConical}
            query={labQuery}
            onQuery={setLabQuery}
            placeholder="Laboratoriya qidirish…"
            loading={loading}
            primaryColor={primaryColor}
            emptyText="Global laboratoriya topilmadi"
            headerAction={filteredLabs.length > 0 ? (
              <button
                type="button"
                onClick={toggleAllLabs}
                className="text-[11px] font-semibold"
                style={{ color: primaryColor }}
              >
                {filteredLabs.every(lab => selectedLabIds.has(lab.id)) ? "Bekor qilish" : "Barchasini tanlash"}
              </button>
            ) : null}
          >
            {filteredLabs.map(lab => {
              const checked = selectedLabIds.has(lab.id);
              const already = existingLabNames.has(normName(lab.name));
              return (
                <label
                  key={lab.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                    checked ? "border-transparent" : "border-border hover:bg-secondary/70"
                  }`}
                  style={checked ? { background: `${primaryColor}14` } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLab(lab.id)}
                    className="mt-0.5 h-4 w-4"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{lab.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {already ? "Tashkilotda mavjud" : `ID #${lab.id}`}
                    </span>
                  </span>
                </label>
              );
            })}
          </PickerColumn>

          <PickerColumn
            title="Analizlar"
            icon={TestTube2}
            query={analysisQuery}
            onQuery={setAnalysisQuery}
            placeholder="Analiz qidirish…"
            loading={loading}
            primaryColor={primaryColor}
            emptyText={selectedLabIds.size === 0 ? "Avval laboratoriya tanlang" : "Bu labda analiz yo'q"}
            headerAction={labAnalyses.length > 0 ? (
              <button
                type="button"
                onClick={toggleAllAnalyses}
                className="text-[11px] font-semibold"
                style={{ color: primaryColor }}
              >
                {labAnalyses.every(item => selectedAnalysisIds.has(item.id)) ? "Bekor qilish" : "Barchasini tanlash"}
              </button>
            ) : null}
          >
            {labAnalyses.map(item => {
              const checked = selectedAnalysisIds.has(item.id);
              const labName = labById.get(baseAnalysisLabId(item) ?? -1)?.name ?? "";
              const already = labName
                ? existingAnalysisKeys.has(`${normName(labName)}::${normName(item.name)}`)
                : false;
              return (
                <label
                  key={item.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${
                    checked ? "border-transparent" : "border-border hover:bg-secondary/70"
                  }`}
                  style={checked ? { background: `${primaryColor}14` } : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAnalysis(item.id)}
                    className="mt-0.5 h-4 w-4"
                    style={{ accentColor: primaryColor }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{item.name}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {[item.shortname || null, labName || null, already ? "allaqachon qo'shilgan" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
              );
            })}
          </PickerColumn>

          <PickerColumn
            title="Global PDF shablonlar"
            icon={FileType}
            query={templateQuery}
            onQuery={setTemplateQuery}
            placeholder="Shablon qidirish…"
            loading={loading}
            primaryColor={primaryColor}
            emptyText={
              selectedAnalyses.length === 0
                ? "Avval analizlarni tanlang"
                : "Tanlangan analizlarga shablon yo'q"
            }
            headerAction={matchingTemplates.length > 0 ? (
              <button
                type="button"
                onClick={toggleAllTemplates}
                className="text-[11px] font-semibold"
                style={{ color: primaryColor }}
              >
                {matchingTemplates.every(item => selectedTemplateIds.has(item.id)) ? "Bekor qilish" : "Barchasini tanlash"}
              </button>
            ) : null}
          >
            {matchingTemplates.map(item => {
              const checked = selectedTemplateIds.has(item.id);
              const already = hasAnyKey(
                identityKeys(item.name, item.baseanalysis?.name, item.analysis?.name),
                existingTemplateKeys,
              );
              const previewBusy = previewLoadingId === item.id;
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-2 rounded-xl border px-3 py-3 ${
                    checked ? "border-transparent" : "border-border hover:bg-secondary/70"
                  }`}
                  style={checked ? { background: `${primaryColor}14` } : undefined}
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTemplate(item.id)}
                      className="mt-0.5 h-4 w-4"
                      style={{ accentColor: primaryColor }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{item.name}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {item.analysis?.name
                          || item.baseanalysis?.name
                          || (item.analysis_id ? `Analiz #${item.analysis_id}` : "Analiz biriktirilmagan")}
                        {already ? " · tashkilotda mavjud" : ""}
                      </span>
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => void openTemplatePreview(item)}
                    disabled={previewBusy}
                    title="PDF shablonni ko'rish"
                    className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-60"
                  >
                    {previewBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })}
          </PickerColumn>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4 shrink-0 max-sm:flex-col">
          <p className="text-[12px] text-muted-foreground">
            {selectedLabs.length} ta laboratoriya
            {" · "}
            {selectedAnalyses.length} ta analiz
            {" · "}
            {selectedMatchingTemplates.length} ta shablon
          </p>
          <div className="flex w-full max-w-sm gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
            >
              Bekor qilish
            </button>
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                const groups = buildSaveGroups();
                if (groups.length === 0) return;
                onSave({ groups });
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{ background: primaryColor }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Saqlash
            </button>
          </div>
        </div>
      </div>
    </div>

    {previewOpen && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeTemplatePreview} />
        <div className="relative flex h-[90vh] w-full max-w-[920px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4 shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <FileType className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <h3 className="truncate text-[14px] font-semibold text-foreground">
                  {previewTemplate?.name || previewTitle || "PDF shablon"}
                </h3>
                <p className="truncate text-[11px] text-muted-foreground">
                  {previewTemplate?.analysisName
                    ? previewTemplate.analysisName
                    : previewTemplate?.analysisId
                      ? `Analiz #${previewTemplate.analysisId}`
                      : "Shablon ko'rinishi"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeTemplatePreview}
              className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-secondary/40 p-4">
            {previewLoading ? (
              <div className="flex h-full min-h-[280px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
              </div>
            ) : previewError ? (
              <div className="flex h-full min-h-[280px] items-center justify-center">
                <div className="flex max-w-sm items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-950/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-xs leading-relaxed text-red-700 dark:text-red-300">{previewError}</p>
                </div>
              </div>
            ) : previewTemplate ? (
              <div className="flex justify-center">
                <ResultPdfCanvas
                  template={previewTemplate}
                  fillValues={{}}
                  dynamicCtx={null}
                  readOnly
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function PickerColumn({
  title,
  icon: Icon,
  query,
  onQuery,
  placeholder,
  loading,
  primaryColor,
  emptyText,
  headerAction,
  children,
}: {
  title: string;
  icon: React.ElementType;
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  loading: boolean;
  primaryColor: string;
  emptyText: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  const items = React.Children.toArray(children);
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-secondary/20">
      <div className="border-b border-border px-4 py-3">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color: primaryColor }} />
            <p className="text-[13px] font-semibold">{title}</p>
          </div>
          {headerAction}
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={e => onQuery(e.target.value)}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 ses-scrollbar">
        {loading ? (
          <div className="flex h-full min-h-[180px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: primaryColor }} />
          </div>
        ) : items.length === 0 ? (
          <p className="px-2 py-10 text-center text-[12px] text-muted-foreground">{emptyText}</p>
        ) : items}
      </div>
    </div>
  );
}

export function CompanyGlobalDataSection({
  primaryColor,
  companyId,
}: {
  primaryColor: string;
  companyId: number;
}) {
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<CatalogRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const pushToast = (text: string, type: ToastMsg["type"] = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3200);
  };

  const load = async (extras?: {
    labs?: Laboratory[];
    analyses?: Analysis[];
    templates?: { id: number; name: string; analysisName: string; analysisId: number }[];
  }) => {
    setLoading(true);
    setError(null);
    try {
      const [allLabs, labsFull, allAnalyses, analysesFull, allTemplates, companyRaw] = await Promise.all([
        getAllLaboratories(companyId).catch(() => [] as Laboratory[]),
        getLaboratoriesFull({ companyId, page: 1, limit: 500 }).catch(() => ({ data: [] as Laboratory[] })),
        getAllAnalyses(companyId).catch(() => [] as Analysis[]),
        getAnalysesFull({ companyId, page: 1, limit: 500 }).catch(() => ({ data: [] as Analysis[] })),
        getAllOnlineStorages(companyId).catch(() => []),
        getCompanyById(companyId),
      ]);
      const company = unwrapCompany(companyRaw);
      const labs = resolveCompanyLaboratories(
        [
          ...(Array.isArray(allLabs) ? allLabs : []),
          ...(Array.isArray(labsFull.data) ? labsFull.data : []),
        ],
        company,
        companyId,
      );
      const analysisPool = [
        ...(Array.isArray(allAnalyses) ? allAnalyses : []),
        ...(Array.isArray(analysesFull.data) ? analysesFull.data : []),
        ...(extras?.analyses ?? []),
      ].filter(item => {
        const cid = Number(item.company_id ?? item.companyId ?? item.company?.id);
        return !Number.isFinite(cid) || cid <= 0 || cid === companyId;
      });
      const labMap = new Map(labs.map(lab => [lab.id, lab]));
      for (const lab of extras?.labs ?? []) {
        const id = Number(lab.id);
        if (Number.isFinite(id) && id > 0) {
          labMap.set(id, {
            ...lab,
            id,
            company_id: laboratoryCompanyId(lab) ?? companyId,
            companyId: laboratoryCompanyId(lab) ?? companyId,
            company: lab.company ?? { id: companyId },
          });
        }
      }

      for (const item of analysisPool) {
        const labId = analysisLabId(item);
        if (labId == null || labMap.has(labId)) continue;
        const cid = Number(item.company_id ?? item.companyId ?? item.company?.id);
        if (Number.isFinite(cid) && cid > 0 && cid !== companyId) continue;
        labMap.set(labId, {
          id: labId,
          name: item.laboratory?.name || `Laboratoriya #${labId}`,
          createdAt: item.laboratory?.createdAt || "",
          analysis: [],
          lab_director: null,
          lab_assistants: [],
        });
      }

      const resolvedLabs = [...labMap.values()];
      const labIds = new Set(resolvedLabs.map(lab => lab.id));
      const analysisMap = new Map<number, Analysis>();

      for (const item of analysisPool) {
        const labId = analysisLabId(item);
        if (labId == null || !labIds.has(labId)) continue;
        analysisMap.set(item.id, item);
      }
      for (const lab of resolvedLabs) {
        for (const nested of lab.analysis ?? []) {
          const parsed = analysisFromLabNested(nested, lab);
          if (parsed && !analysisMap.has(parsed.id)) analysisMap.set(parsed.id, parsed);
        }
      }

      const analyses = [...analysisMap.values()];
      const analysisIds = new Set(analyses.map(item => item.id));
      const analysisById = new Map(analyses.map(item => [item.id, item]));
      const templates = (Array.isArray(allTemplates) ? allTemplates : []).flatMap(item => {
        const analysisId = resolveOnlineStorageAnalysisId(item);
        if (analysisId == null || !analysisIds.has(analysisId)) return [];
        return [{
          id: item.id,
          name: item.name,
          analysisName: item.analysis?.name || analysisById.get(analysisId)?.name || `Analiz #${analysisId}`,
          analysisId,
        }];
      });
      const templateMap = new Map(templates.map(item => [item.id, item]));
      for (const item of extras?.templates ?? []) {
        if (item?.id && !templateMap.has(item.id) && analysisIds.has(item.analysisId)) {
          templateMap.set(item.id, item);
        }
      }
      const mergedTemplates = [...templateMap.values()];

      const nextRows = resolvedLabs.map(lab => {
        const labAnalyses = analyses.filter(item => analysisLabId(item) === lab.id);
        const labAnalysisIds = new Set(labAnalyses.map(item => item.id));
        return {
          lab,
          analyses: labAnalyses,
          templates: mergedTemplates.filter(item => labAnalysisIds.has(item.analysisId)),
        };
      });
      setRows(nextRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ma'lumotlarni yuklab bo'lmadi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(row =>
      row.lab.name.toLowerCase().includes(q)
      || row.analyses.some(item => item.name.toLowerCase().includes(q) || item.shortname.toLowerCase().includes(q))
      || row.templates.some(item => item.name.toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const existingLabNames = useMemo(
    () => new Set(rows.map(row => normName(row.lab.name))),
    [rows],
  );
  const existingAnalysisKeys = useMemo(
    () => new Set(
      rows.flatMap(row => row.analyses.map(item => `${normName(row.lab.name)}::${normName(item.name)}`)),
    ),
    [rows],
  );
  const existingTemplateKeys = useMemo(
    () => new Set(
      rows.flatMap(row =>
        row.templates.flatMap(item => identityKeys(item.name, item.analysisName)),
      ),
    ),
    [rows],
  );

  const handleSave = async (payload: {
    groups: Array<{
      lab: BaseLaboratory;
      analyses: BaseAnalysis[];
      templates: GlobalStorage[];
    }>;
  }) => {
    setSaving(true);
    try {
      const currentLabs = await getAllLaboratories(companyId).catch(() => [] as Laboratory[]);
      const labsFull = await getLaboratoriesFull({ companyId, page: 1, limit: 500 }).catch(() => ({ data: [] as Laboratory[] }));
      const currentAnalyses = await getAllAnalyses(companyId).catch(() => [] as Analysis[]);
      const nestedCompany = unwrapCompany(await getCompanyById(companyId));
      const liveLabs = resolveCompanyLaboratories(
        [...currentLabs, ...(Array.isArray(labsFull.data) ? labsFull.data : [])],
        nestedCompany,
        companyId,
      );

      const extraLabs: Laboratory[] = [];
      const extraAnalyses: Analysis[] = [];
      const extraTemplates: { id: number; name: string; analysisName: string; analysisId: number }[] = [];
      const templateErrors: string[] = [];
      let createdCount = 0;

      for (const group of payload.groups) {
        let companyLab = liveLabs.find(lab => normName(lab.name) === normName(group.lab.name)) ?? null;
        if (companyLab == null) {
          const created = await addLaboratory({ name: group.lab.name.trim(), company_id: companyId });
          const labId = extractId(created);
          if (labId == null) throw new Error("Laboratoriya yaratildi, lekin ID topilmadi");
          companyLab = {
            id: labId,
            name: group.lab.name.trim(),
            createdAt: "",
            analysis: [],
            lab_director: null,
            lab_assistants: [],
            company_id: companyId,
            companyId: companyId,
            company: { id: companyId },
          };
          liveLabs.push(companyLab);
          createdCount += 1;
        }
        extraLabs.push(companyLab);

        const analysisIdByBaseId = new Map<number, number>();
        const analysisIdByName = new Map<string, number>();

        for (const item of [...currentAnalyses, ...extraAnalyses]) {
          if (Number(item.laboratory?.id) !== Number(companyLab.id)) continue;
          analysisIdByName.set(normName(item.name), item.id);
        }

        for (const analysis of group.analyses) {
          const existingId = analysisIdByName.get(normName(analysis.name));
          const analysisId = existingId ?? extractId(await addAnalysis({
            name: analysis.name.trim(),
            shortname: analysis.shortname.trim() || analysis.name.trim(),
            price: String(analysis.price ?? "0"),
            laboratory_id: companyLab.id,
            company_id: companyId,
          }));
          if (existingId == null) createdCount += 1;
          if (existingId == null && analysisId == null) {
            throw new Error(`"${analysis.name}" analizi yaratildi, lekin ID topilmadi`);
          }
          if (analysisId == null) continue;
          analysisIdByBaseId.set(analysis.id, analysisId);
          analysisIdByName.set(normName(analysis.name), analysisId);
          extraAnalyses.push({
            id: analysisId,
            name: analysis.name.trim(),
            shortname: analysis.shortname.trim() || analysis.name.trim(),
            price: String(analysis.price ?? "0"),
            createdAt: "",
            company_id: companyId,
            companyId: companyId,
            company: { id: companyId },
            laboratory: {
              id: companyLab.id,
              name: companyLab.name,
              createdAt: companyLab.createdAt,
              lab_director: companyLab.lab_director,
            },
          });
        }

        for (const template of group.templates) {
          try {
            const matchedBase = group.analyses.find(item => templateMatchesAnalyses(template, [item]));
            const globalAnalysisId = resolveGlobalStorageAnalysisId(template);
            const companyAnalysisId =
              (matchedBase != null ? analysisIdByBaseId.get(matchedBase.id) : undefined)
              ?? (matchedBase != null ? analysisIdByName.get(normName(matchedBase.name)) : undefined)
              ?? analysisIdByName.get(normName(template.baseanalysis?.name))
              ?? analysisIdByName.get(normName(template.analysis?.name))
              ?? (globalAnalysisId != null ? analysisIdByBaseId.get(globalAnalysisId) : undefined)
              ?? analysisIdByName.get(normName(globalStorageRecordToPdfTemplate(template)?.analysisName))
              ?? analysisIdByName.get(normName(template.name))
              ?? (group.analyses.length === 1 ? analysisIdByBaseId.get(group.analyses[0].id) : undefined)
              ?? (group.analyses[0] != null ? analysisIdByName.get(normName(group.analyses[0].name)) : undefined);
            if (companyAnalysisId == null) {
              throw new Error(`"${template.name}" shabloni uchun tashkilot analizi topilmadi`);
            }

            const analysisName =
              matchedBase?.name
              || template.baseanalysis?.name
              || template.analysis?.name
              || group.analyses.find(item => analysisIdByBaseId.get(item.id) === companyAnalysisId)?.name
              || "";

            const full = await getGlobalStorageById(template.id).catch(() => template);
            const parsed = globalStorageRecordToPdfTemplate(full) ?? globalStorageRecordToPdfTemplate(template);
            if (!parsed) throw new Error(`"${template.name}" shablonini o'qib bo'lmadi`);
            const saved = await upsertPdfTemplateRemote(
              remapTemplateToAnalysis(parsed, companyAnalysisId, analysisName, companyId),
              companyId,
            );
            extraTemplates.push({
              id: saved.storageId ?? template.id,
              name: saved.name || template.name,
              analysisName,
              analysisId: companyAnalysisId,
            });
            createdCount += 1;
          } catch (err) {
            templateErrors.push(
              err instanceof ApiError
                ? err.message
                : (err instanceof Error ? err.message : `"${template.name}" shablonini ko'chirib bo'lmadi`),
            );
          }
        }
      }

      const synced = await ensureCompanyPdfTemplatesFromGlobal(companyId).catch(() => 0);
      if (synced > 0) createdCount += synced;

      if (templateErrors.length > 0 && extraLabs.length === 0) {
        pushToast(templateErrors[0], "error");
      } else if (templateErrors.length > 0) {
        pushToast(
          `Lab va analizlar saqlandi, lekin PDF: ${templateErrors[0]}`,
          "error",
        );
      } else {
        pushToast("Tanlangan global ma'lumotlar tashkilotga biriktirildi");
      }
      setModalOpen(false);
      setPage(1);
      setSearch("");
      setSearchInput("");
      await load({ labs: extraLabs, analyses: extraAnalyses, templates: extraTemplates });
      if (createdCount === 0 && extraLabs.length === 0) {
        pushToast("Yangi ma'lumot qo'shilmadi", "error");
      }
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : (err instanceof Error ? err.message : "Saqlashda xatolik"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRow = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      for (const template of deleteRow.templates) {
        await deleteOnlineStorage(template.id, companyId).catch(() => undefined);
      }
      for (const analysis of deleteRow.analyses) {
        await deleteAnalysis(analysis.id, companyId).catch(() => undefined);
      }
      await deleteLaboratory(deleteRow.lab.id, companyId);
      pushToast(`"${deleteRow.lab.name}" o'chirildi`);
      setDeleteRow(null);
      await load();
    } catch (err) {
      pushToast(err instanceof ApiError ? err.message : "O'chirishda xatolik", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl bg-secondary px-3.5 py-2.5">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { setPage(1); setSearch(searchInput.trim()); } }}
              placeholder="Laboratoriya, analiz yoki shablon bo'yicha qidirish…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setPage(1); setSearch(searchInput.trim()); }}
            className="rounded-xl border border-border px-3.5 py-2.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Qidirish
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border border-border p-2.5 text-muted-foreground transition-colors hover:bg-secondary"
            title="Yangilash"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: primaryColor }}
          >
            <Plus className="h-4 w-4" />
            Ma'lumot qo'shish
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 dark:border-red-800 dark:bg-red-950/30">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <p className="text-xs leading-relaxed text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Laboratoriya", "Analizlar", "PDF shablonlar", "Yaratilgan", ""].map((h, i) => (
                  <th key={h || `act-${i}`} className="whitespace-nowrap px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: primaryColor }} />
                      <p className="text-sm text-muted-foreground">Yuklanmoqda…</p>
                    </div>
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                        <Database className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Hali ma'lumot biriktirilmagan</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Global laboratoriyalar, analizlar va PDF shablonlarni shu yerdan qo'shing
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : paged.map(row => (
                <tr key={row.lab.id} className="group border-b border-border">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ background: primaryColor }}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold leading-tight">{row.lab.name}</div>
                        <div className="text-[11px] text-muted-foreground">ID #{row.lab.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {row.analyses.length === 0 ? (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.analyses.slice(0, 4).map(item => (
                          <span key={item.id} className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-medium">
                            {item.name}
                          </span>
                        ))}
                        {row.analyses.length > 4 && (
                          <span className="rounded-lg bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                            +{row.analyses.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    {row.templates.length === 0 ? (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {row.templates.slice(0, 3).map(item => (
                          <span key={item.id} className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-medium">
                            {item.name}
                          </span>
                        ))}
                        {row.templates.length > 3 && (
                          <span className="rounded-lg bg-secondary px-2 py-1 text-[11px] text-muted-foreground">
                            +{row.templates.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-pre-line px-5 py-3.5 text-[12px] text-muted-foreground">
                    {formatDate(row.lab.createdAt)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      title="O'chirish"
                      disabled={deleting}
                      onClick={() => setDeleteRow(row)}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-5 py-4">
          <span className="text-xs text-muted-foreground">
            {filtered.length === 0
              ? "0 ta laboratoriya"
              : `${(safePage - 1) * PER_PAGE + 1}–${Math.min(safePage * PER_PAGE, filtered.length)} / ${filtered.length} ta`}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setPage(1)} disabled={safePage === 1 || loading} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30">
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1 || loading} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
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
                      type="button"
                      onClick={() => setPage(p as number)}
                      disabled={loading}
                      className="h-8 w-8 rounded-lg text-xs font-semibold transition-all"
                      style={safePage === p ? { background: primaryColor, color: "#fff" } : { color: "var(--muted-foreground)" }}
                    >
                      {p}
                    </button>
                  ),
              )}
            <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages || loading} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30">
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={() => setPage(totalPages)} disabled={safePage === totalPages || loading} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-30">
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <AddGlobalDataModal
          primaryColor={primaryColor}
          saving={saving}
          existingLabNames={existingLabNames}
          existingAnalysisKeys={existingAnalysisKeys}
          existingTemplateKeys={existingTemplateKeys}
          onSave={payload => void handleSave(payload)}
          onClose={() => { if (!saving) setModalOpen(false); }}
        />
      )}

      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={() => { if (!deleting) setDeleteRow(null); }} />
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <div className="p-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <Trash2 className="h-6 w-6 text-red-500" />
              </div>
              <h2 className="mb-2 text-[16px] font-bold text-foreground">Ma'lumotni o'chirish</h2>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{deleteRow.lab.name}</span>
                {" "}laboratoriyasi, undagi {deleteRow.analyses.length} ta analiz va {deleteRow.templates.length} ta PDF shablon o'chiriladi.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                type="button"
                onClick={() => setDeleteRow(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteRow()}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 active:scale-[0.98] disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
                Ha, o'chirish
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-6 right-6 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl ${
              t.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {t.type === "success"
              ? <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              : <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
