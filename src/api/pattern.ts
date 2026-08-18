import { apiRequest } from "./client";

export type PatternAnalysis = {
  id: number;
  name: string;
  shortname?: string;
  laboratory?: {
    id: number;
    name: string;
  } | null;
} | null;

export type Pattern = {
  id: number;
  analysis_id?: number;
  analysisId?: number;
  name: string;
  have_or_not: boolean;
  unit: string | null;
  norm: string | null;
  min: number | null;
  max: number | null;
  standard: string | null;
  have_or_notValue: boolean | string | null;
  unitValue: string | null;
  normValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  standardValue: string | null;
  createdAt?: string;
  analysis?: PatternAnalysis;
};

export function resolvePatternAnalysisId(p: {
  analysis_id?: number | string | null;
  analysisId?: number | string | null;
  analysis?: { id?: number | string | null } | null;
}): number | null {
  const raw = p.analysis_id ?? p.analysisId ?? p.analysis?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type PatternPayload = {
  analysis_id: number;
  name: string;
  have_or_not: boolean;
  unit: string | null;
  norm: string | null;
  min: number | null;
  max: number | null;
  standard: string | null;
  have_or_notValue: boolean | string | null;
  unitValue: string | null;
  normValue: string | null;
  minValue: number | null;
  maxValue: number | null;
  standardValue: string | null;
};

function normalizeList(raw: unknown): Pattern[] {
  let list: Pattern[] = [];
  if (Array.isArray(raw)) list = raw as Pattern[];
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.patterns ?? obj.items ?? obj.result;
    if (Array.isArray(data)) list = data as Pattern[];
  }

  return list.map(p => {
    const analysis_id = resolvePatternAnalysisId(p);
    return analysis_id != null ? { ...p, analysis_id } : p;
  });
}

export async function getAllPatterns() {
  const raw = await apiRequest<unknown>("/pattern/getall", {
    method: "GET",
    fallbackError: "Patternlarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export function getPatternById(id: number) {
  return apiRequest<Pattern>(`/pattern/getby/${id}`, {
    method: "GET",
    fallbackError: "Patternni yuklab bo'lmadi",
  });
}

export function addPattern(payload: PatternPayload) {
  return apiRequest<Pattern>("/pattern/add", {
    method: "POST",
    body: payload,
    fallbackError: "Pattern qo'shib bo'lmadi",
  });
}

export function updatePattern(id: number, payload: PatternPayload) {
  return apiRequest<Pattern>(`/pattern/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Patternni yangilab bo'lmadi",
  });
}

export function deletePattern(id: number) {
  return apiRequest<unknown>(`/pattern/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Patternni o'chirib bo'lmadi",
  });
}
