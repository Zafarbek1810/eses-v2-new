import { apiRequest } from "./client";

/** One measured row inside a result (matches backend `result_item[]`) */
export type ResultItemPayload = {
  analysis_id: number;
  analysisId?: number;
  analysis?: { id?: number } | null;
  name: string;
  have_or_not: boolean | null;
  unit: string | null;
  norm: string | null;
  min: number | null;
  max: number | null;
  standard: string | null;
  have_or_notValue: boolean | null;
  unitValue: string | null;
  normValue: string | null;
  norm_value?: string | null;
  minValue: number | null;
  maxValue: number | null;
  standardValue: string | null;
};

export type ResultPayload = {
  order_id: number;
  lab_director_id: number;
  result_item: ResultItemPayload[];
};

export type ResultRecord = {
  id: number;
  order_id?: number;
  orderId?: number;
  lab_director_id?: number;
  labDirectorId?: number;
  result_item?: ResultItemPayload[];
  result_items?: ResultItemPayload[];
  resultItems?: ResultItemPayload[];
  items?: ResultItemPayload[];
  order?: {
    id: number;
    name?: string | null;
    patient?: {
      id?: number;
      first_name?: string;
      last_name?: string;
    } | null;
  } | null;
  lab_director?: {
    id: number;
    username?: string;
    surname?: string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
};

export type SeverityValues = {
  mild: string;
  moderate: string;
  severe: string;
};

export function resolveResultOrderId(
  r: Pick<ResultRecord, "order_id" | "orderId" | "order">,
): number | null {
  const raw = r.order_id ?? r.orderId ?? r.order?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveResultItemAnalysisId(
  item: Pick<ResultItemPayload, "analysis_id" | "analysisId" | "analysis"> &
    Record<string, unknown>,
): number | null {
  const raw = item.analysis_id ?? item.analysisId ?? item.analysis?.id;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const GRID_PREFIX = "__grid__:";
const SEV_PREFIX = "__sev__:";

export function getResultItemNormValue(
  item: Pick<ResultItemPayload, "normValue" | "norm_value"> & Record<string, unknown>,
): string {
  const raw = item.normValue ?? item.norm_value ?? "";
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    // Severity object (API parse qilgan bo'lishi mumkin)
    if ("mild" in obj || "moderate" in obj || "severe" in obj) {
      return `${SEV_PREFIX}${JSON.stringify({
        mild: String(obj.mild ?? ""),
        moderate: String(obj.moderate ?? ""),
        severe: String(obj.severe ?? ""),
      })}`;
    }
    // Grid fill map
    return `${GRID_PREFIX}${JSON.stringify(raw)}`;
  }
  return String(raw ?? "").trim();
}

function coerceResultItemList(raw: unknown): ResultItemPayload[] {
  if (Array.isArray(raw)) return raw as ResultItemPayload[];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ResultItemPayload[];
    } catch {
      /* ignore */
    }
  }
  return [];
}

export function getResultItems(r: ResultRecord | null | undefined): ResultItemPayload[] {
  if (!r) return [];
  const bag = r as Record<string, unknown>;
  const candidates = [
    bag.result_item,
    bag.result_items,
    bag.resultItems,
    bag.ResultItem,
    bag.ResultItems,
    bag.items,
  ];
  for (const c of candidates) {
    const list = coerceResultItemList(c);
    if (list.length > 0) return list;
  }
  // Bo'sh massiv topilsa ham qaytaramiz (yuqorida length 0 skip qilindi)
  for (const c of candidates) {
    if (Array.isArray(c)) return c as ResultItemPayload[];
  }
  return [];
}

function normalizeResultRecord(raw: unknown): ResultRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  let rec = raw as ResultRecord;
  let outerItems = getResultItems(rec);

  const inner = obj.data ?? obj.result ?? obj.item;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    const nested = inner as ResultRecord;
    const nestedItems = getResultItems(nested);
    // Nested entity + tashqi envelope dagi itemlarni birlashtiramiz
    // (ba'zi API lar id ni data ichida, result_item ni tashqarida qaytaradi)
    if (nested.id != null || nestedItems.length > 0 || outerItems.length > 0) {
      const mergedItems = nestedItems.length > 0 ? nestedItems : outerItems;
      rec = {
        ...(raw as ResultRecord),
        ...nested,
        result_item: mergedItems,
      };
      outerItems = mergedItems;
    }
  }

  const items = getResultItems(rec);
  const orderId = resolveResultOrderId(rec);
  const id = Number(rec.id);
  if (!Number.isFinite(id) || id <= 0) {
    // Still return a usable shell if items exist (add/update sometimes omit id shape)
    if (items.length === 0) return null;
  }

  return {
    ...rec,
    ...(Number.isFinite(id) && id > 0 ? { id } : {}),
    ...(orderId != null ? { order_id: orderId } : {}),
    result_item: items.map(item => {
      const analysisId = resolveResultItemAnalysisId(item);
      const normRaw = item.normValue ?? item.norm_value;
      let normValue: string | null = null;
      if (normRaw && typeof normRaw === "object" && !Array.isArray(normRaw)) {
        const obj = normRaw as Record<string, unknown>;
        if ("mild" in obj || "moderate" in obj || "severe" in obj) {
          normValue = `${SEV_PREFIX}${JSON.stringify({
            mild: String(obj.mild ?? ""),
            moderate: String(obj.moderate ?? ""),
            severe: String(obj.severe ?? ""),
          })}`;
        } else {
          normValue = `${GRID_PREFIX}${JSON.stringify(normRaw)}`;
        }
      } else {
        const asStr = getResultItemNormValue(item);
        normValue = asStr || null;
      }
      return {
        ...item,
        ...(analysisId != null ? { analysis_id: analysisId } : {}),
        normValue,
      };
    }),
  };
}

function normalizeList(raw: unknown): ResultRecord[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.results ?? obj.items ?? obj.result;
    if (Array.isArray(data)) list = data;
  }
  return list
    .map(normalizeResultRecord)
    .filter((r): r is ResultRecord => r != null && Number.isFinite(Number(r.id)));
}

export async function getAllResults(options?: { auth?: boolean }) {
  const raw = await apiRequest<unknown>("/result/getall", {
    method: "GET",
    auth: options?.auth ?? true,
    fallbackError: "Natijalarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getResultById(id: number, options?: { auth?: boolean }) {
  const raw = await apiRequest<unknown>(`/result/getby/${id}`, {
    method: "GET",
    auth: options?.auth ?? true,
    fallbackError: "Natijani yuklab bo'lmadi",
  });
  const normalized = normalizeResultRecord(raw);
  if (!normalized) {
    throw new Error("Natijani yuklab bo'lmadi");
  }
  return normalized;
}

/**
 * SMS / public link — token talab qilinmaydi.
 * `:id` — buyurtma (order) id; natija shu order bo'yicha qaytadi.
 */
export async function getResultByIdTwo(orderId: number) {
  const raw = await apiRequest<unknown>(`/result/getbytwo/${orderId}`, {
    method: "GET",
    auth: false,
    fallbackError: "Natijani yuklab bo'lmadi",
  });
  let normalized = normalizeResultRecord(raw);

  // Ba'zan getbytwo parent ni qaytaradi, itemlar list/envelope da bo'ladi
  if (!normalized || getResultItems(normalized).length === 0) {
    const list = normalizeList(raw);
    const byOrder = findResultByOrderId(list, orderId);
    const richer =
      (byOrder && getResultItems(byOrder).length > 0 ? byOrder : null) ??
      list.find(r => getResultItems(r).length > 0) ??
      byOrder ??
      list[0] ??
      null;
    if (richer) {
      if (!normalized) return richer;
      if (getResultItems(normalized).length === 0 && getResultItems(richer).length > 0) {
        return {
          ...normalized,
          ...richer,
          id: normalized.id || richer.id,
          order_id: resolveResultOrderId(normalized) ?? resolveResultOrderId(richer) ?? orderId,
          result_item: getResultItems(richer),
        };
      }
    }
  }

  if (!normalized) {
    throw new Error("Natijani yuklab bo'lmadi");
  }
  return normalized;
}

export function deleteResult(id: number) {
  return apiRequest<unknown>(`/result/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Natijani o'chirib bo'lmadi",
  });
}

export function findResultByOrderId(
  results: ResultRecord[],
  orderId: number,
): ResultRecord | null {
  return results.find(r => resolveResultOrderId(r) === orderId) ?? null;
}

export const PDF_TABLE_RESULT_NAME = "__pdf_table__";

/** Pack mild/moderate/severe into normValue (string), keep other Value fields API-compatible */
export function encodeSeverityToNormValue(sev: SeverityValues): string | null {
  const mild = sev.mild.trim();
  const moderate = sev.moderate.trim();
  const severe = sev.severe.trim();
  if (!mild && !moderate && !severe) return null;
  // Single moderate-only → plain string (compatible with sample API style)
  if (!mild && !severe && moderate) return moderate;
  return `${SEV_PREFIX}${JSON.stringify({ mild, moderate, severe })}`;
}

export function decodeSeverityFromItem(item: ResultItemPayload): SeverityValues {
  const raw = getResultItemNormValue(item);
  if (raw.startsWith(SEV_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(SEV_PREFIX.length)) as Partial<SeverityValues>;
      return {
        mild: parsed.mild ?? "",
        moderate: parsed.moderate ?? "",
        severe: parsed.severe ?? "",
      };
    } catch {
      return { mild: "", moderate: raw, severe: "" };
    }
  }
  // Plain normValue → ўрта column (classic lab result)
  return { mild: "", moderate: raw, severe: "" };
}

/** Free-form PDF table fill values keyed by "row:col" */
export function encodeGridFill(values: Record<string, string>): string {
  return `${GRID_PREFIX}${JSON.stringify(values)}`;
}

function parseGridFillPayload(raw: unknown): Record<string, string> | null {
  if (raw == null || raw === "") return null;

  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const entries = Object.entries(obj);
    if (entries.length === 0) return {};
    // Fill map: "0:1", "h:0:0" — severity map emas
    const looksLikeFill = entries.some(([k]) => /^\d+:\d+$/.test(k) || /^h:\d+:\d+$/.test(k));
    if (looksLikeFill) {
      return Object.fromEntries(entries.map(([k, v]) => [k, String(v ?? "")]));
    }
    return null;
  }

  if (typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  if (s.startsWith(GRID_PREFIX)) s = s.slice(GRID_PREFIX.length);
  // Severity yoki oddiy matn — grid emas
  if (s.startsWith(SEV_PREFIX)) return null;
  try {
    const parsed = JSON.parse(s) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const obj = parsed as Record<string, unknown>;
    const entries = Object.entries(obj);
    const looksLikeFill =
      entries.length === 0 ||
      entries.some(([k]) => /^\d+:\d+$/.test(k) || /^h:\d+:\d+$/.test(k));
    if (!looksLikeFill) return null;
    return Object.fromEntries(entries.map(([k, v]) => [k, String(v ?? "")]));
  } catch {
    return null;
  }
}

function isGridMetaItem(item: ResultItemPayload): boolean {
  if (item.name === PDF_TABLE_RESULT_NAME) return true;
  const bag = item as Record<string, unknown>;
  const raw = bag.normValue ?? bag.norm_value ?? "";
  if (typeof raw === "object" && raw && !Array.isArray(raw)) {
    return parseGridFillPayload(raw) != null;
  }
  const norm = String(raw ?? "").trim();
  return norm.startsWith(GRID_PREFIX) || parseGridFillPayload(norm) != null;
}

export function decodeGridFillFromItems(
  items: ResultItemPayload[],
  analysisId: number,
): Record<string, string> {
  const matched = items.filter(
    i => resolveResultItemAnalysisId(i) === analysisId && isGridMetaItem(i),
  );
  const meta =
    matched[0] ??
    // Fallback: single grid payload on this result (analysis id field missing/mismatched)
    (items.filter(isGridMetaItem).length === 1
      ? items.find(isGridMetaItem)
      : // Oxirgi urinish: shu analysis_id dagi istalgan itemdan grid o'qish
        items.find(i => {
          if (resolveResultItemAnalysisId(i) !== analysisId) return false;
          const bag = i as Record<string, unknown>;
          return parseGridFillPayload(bag.normValue ?? bag.norm_value) != null;
        }));

  if (!meta) return {};
  const bag = meta as Record<string, unknown>;
  return (
    parseGridFillPayload(bag.normValue) ??
    parseGridFillPayload(bag.norm_value) ??
    parseGridFillPayload(getResultItemNormValue(meta)) ??
    {}
  );
}

export function buildResultItemFromGrid(
  analysisId: number,
  fillValues: Record<string, string>,
): ResultItemPayload {
  const any = Object.values(fillValues).some(v => String(v || "").trim());
  return {
    analysis_id: Number(analysisId),
    name: PDF_TABLE_RESULT_NAME,
    have_or_not: null,
    unit: null,
    norm: null,
    min: 0,
    max: 0,
    standard: null,
    have_or_notValue: any ? true : null,
    unitValue: null,
    normValue: encodeGridFill(fillValues),
    minValue: 0,
    maxValue: 0,
    standardValue: null,
  };
}

export function buildResultItemFromPattern(
  analysisId: number,
  pattern: {
    name: string;
    have_or_not: boolean;
    unit: string | null;
    norm: string | null;
    min: number | string | null;
    max: number | string | null;
    standard: string | null;
  },
  sev: SeverityValues,
): ResultItemPayload {
  const mild = sev.mild.trim();
  const moderate = sev.moderate.trim();
  const severe = sev.severe.trim();
  const any = Boolean(mild || moderate || severe);
  const normValue = encodeSeverityToNormValue(sev);
  const measured =
    toApiNumber(moderate) ?? toApiNumber(mild) ?? toApiNumber(severe);

  // Pattern range — must be real numbers for NestJS @IsNumber()
  let min = toApiNumber(pattern.min);
  let max = toApiNumber(pattern.max);

  // Fallback: parse from norm like "120-140" or "3.9-4.7"
  if (min == null || max == null) {
    const fromNorm = parseNormRange(pattern.norm);
    if (min == null) min = fromNorm.min;
    if (max == null) max = fromNorm.max;
  }

  // Last resort: use measured value so fields are never null/NaN
  if (min == null) min = measured ?? 0;
  if (max == null) max = measured ?? min;

  return {
    analysis_id: Number(analysisId),
    name: pattern.name,
    have_or_not: pattern.have_or_not ?? null,
    unit: pattern.unit ?? null,
    norm: pattern.norm ?? null,
    min,
    max,
    standard: pattern.standard ?? null,
    have_or_notValue: any ? true : null,
    unitValue: pattern.unit ?? null,
    normValue,
    minValue: measured ?? min,
    maxValue: measured ?? max,
    standardValue: pattern.standard ?? null,
  };
}

/** Coerce unknown → finite number, else null (never NaN/string) */
export function toApiNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "boolean") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = String(v).trim().replace(",", ".").replace(/[^\d.+-]/g, "");
  if (!t || t === "+" || t === "-" || t === ".") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parseNormRange(norm: string | null | undefined): { min: number | null; max: number | null } {
  if (!norm?.trim()) return { min: null, max: null };
  const m = norm.trim().match(/(-?\d+(?:[.,]\d+)?)\s*[-–—]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return { min: null, max: null };
  return {
    min: toApiNumber(m[1]),
    max: toApiNumber(m[2]),
  };
}

/** Ensure every result_item has numeric min/max/minValue/maxValue before API call */
export function sanitizeResultPayload(payload: ResultPayload): ResultPayload {
  return {
    order_id: Number(payload.order_id),
    lab_director_id: Number(payload.lab_director_id),
    result_item: payload.result_item.map(item => {
      const analysisId = resolveResultItemAnalysisId(item) ?? Number(item.analysis_id);
      const normValue = getResultItemNormValue(item) || item.normValue || null;
      let min = toApiNumber(item.min);
      let max = toApiNumber(item.max);
      let minValue = toApiNumber(item.minValue);
      let maxValue = toApiNumber(item.maxValue);

      if (min == null || max == null) {
        const fromNorm = parseNormRange(item.norm);
        if (min == null) min = fromNorm.min;
        if (max == null) max = fromNorm.max;
      }

      const measured =
        minValue ??
        maxValue ??
        toApiNumber(normValue) ??
        min ??
        max ??
        0;

      if (min == null) min = measured;
      if (max == null) max = measured;
      if (minValue == null) minValue = measured;
      if (maxValue == null) maxValue = measured;

      return {
        analysis_id: Number(analysisId),
        name: item.name,
        have_or_not: item.have_or_not ?? null,
        unit: item.unit ?? null,
        norm: item.norm ?? null,
        min,
        max,
        standard: item.standard ?? null,
        have_or_notValue: item.have_or_notValue ?? null,
        unitValue: item.unitValue ?? null,
        normValue,
        minValue,
        maxValue,
        standardValue: item.standardValue ?? null,
      };
    }),
  };
}

export async function addResult(payload: ResultPayload) {
  const raw = await apiRequest<unknown>("/result/add", {
    method: "POST",
    body: sanitizeResultPayload(payload),
    fallbackError: "Natijani qo'shib bo'lmadi",
  });
  const normalized = normalizeResultRecord(raw);
  // Prefer our payload items if API omits nested result_item on create
  if (normalized) {
    if (getResultItems(normalized).length === 0) {
      return { ...normalized, result_item: payload.result_item };
    }
    return normalized;
  }
  return { id: 0, order_id: payload.order_id, result_item: payload.result_item } as ResultRecord;
}

export async function updateResult(id: number, payload: ResultPayload) {
  const raw = await apiRequest<unknown>(`/result/update/${id}`, {
    method: "PATCH",
    body: sanitizeResultPayload(payload),
    fallbackError: "Natijani yangilab bo'lmadi",
  });
  const normalized = normalizeResultRecord(raw);
  if (normalized) {
    if (getResultItems(normalized).length === 0) {
      return { ...normalized, id, result_item: payload.result_item };
    }
    return { ...normalized, id: normalized.id || id };
  }
  return { id, order_id: payload.order_id, result_item: payload.result_item } as ResultRecord;
}
