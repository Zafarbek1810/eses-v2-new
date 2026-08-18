import { apiRequest } from "./client";

export type OnlineStorage = {
  id: number;
  name: string;
  /** Template elements JSON — API may return array, object, or string */
  text: unknown;
  analysis_id?: number;
  analysisId?: number;
  createdAt?: string;
  updatedAt?: string;
  analysis?: {
    id: number;
    name: string;
  } | null;
};

export type OnlineStoragePayload = {
  name: string;
  text: unknown;
  analysis_id: number;
  company_id?: number;
  companyId?: number;
};

export type OnlineStorageFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number;
};

export type OnlineStorageFullResponse = {
  data: OnlineStorage[];
  total: number;
  page: number;
  limit: number;
};

function pickAnalysisIdRaw(item: {
  analysis_id?: number | string | null;
  analysisId?: number | string | null;
  analysis?: unknown;
}): unknown {
  if (item.analysis_id != null && item.analysis_id !== "") return item.analysis_id;
  if (item.analysisId != null && item.analysisId !== "") return item.analysisId;
  const a = item.analysis;
  if (a == null || a === "") return null;
  if (typeof a === "number" || typeof a === "string") return a;
  if (typeof a === "object") {
    const o = a as Record<string, unknown>;
    return o.id ?? o.analysis_id ?? o.analysisId ?? null;
  }
  return null;
}

export function resolveOnlineStorageAnalysisId(item: {
  analysis_id?: number | string | null;
  analysisId?: number | string | null;
  analysis?: unknown;
}): number | null {
  const n = Number(pickAnalysisIdRaw(item));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractOnlineStorageArray(raw: unknown): OnlineStorage[] {
  if (Array.isArray(raw)) return raw as OnlineStorage[];
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const candidates = [
    obj.data,
    obj.items,
    obj.result,
    obj.onlinestorages,
    obj.onlineStorages,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as OnlineStorage[];
    if (c && typeof c === "object") {
      const nested = c as Record<string, unknown>;
      if (Array.isArray(nested.data)) return nested.data as OnlineStorage[];
      if (Array.isArray(nested.items)) return nested.items as OnlineStorage[];
    }
  }
  return [];
}

function normalizeList(raw: unknown): OnlineStorage[] {
  return extractOnlineStorageArray(raw).map(item => {
    const analysis_id = resolveOnlineStorageAnalysisId(item as {
      analysis_id?: number | string | null;
      analysisId?: number | string | null;
      analysis?: unknown;
    });
    return analysis_id != null ? { ...item, analysis_id } : item;
  });
}

function normalizeFullResponse(
  raw: unknown,
  params: OnlineStorageFullParams,
): OnlineStorageFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    const data = normalizeList(raw);
    return { data, total: data.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = normalizeList(
      obj.data ?? obj.items ?? obj.result ?? obj.onlinestorages ?? obj.onlineStorages ?? [],
    );
    const total =
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.count === "number"
          ? obj.count
          : typeof obj.totalCount === "number"
            ? obj.totalCount
            : data.length;
    const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;

    return {
      data,
      total: typeof meta?.total === "number" ? meta.total : total,
      page:
        typeof obj.page === "number"
          ? obj.page
          : typeof meta?.page === "number"
            ? meta.page
            : page,
      limit:
        typeof obj.limit === "number"
          ? obj.limit
          : typeof meta?.limit === "number"
            ? meta.limit
            : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export function extractOnlineStorageId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const nested =
    (obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>).id
      : undefined) ??
    (obj.onlinestorage && typeof obj.onlinestorage === "object"
      ? (obj.onlinestorage as Record<string, unknown>).id
      : undefined) ??
    (obj.onlineStorage && typeof obj.onlineStorage === "object"
      ? (obj.onlineStorage as Record<string, unknown>).id
      : undefined);
  const candidate = obj.id ?? nested;
  const n = Number(candidate);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function getAllOnlineStorages(companyId?: number) {
  const raw = await apiRequest<unknown>(`/onlinestorage/getall${companyQuery(companyId)}`, {
    method: "GET",
    fallbackError: "PDF shablonlarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getOnlineStoragesFull(
  params: OnlineStorageFullParams = {},
): Promise<OnlineStorageFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.companyId != null) q.set("company_id", String(params.companyId));

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/onlinestorage/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "PDF shablonlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

function companyQuery(companyId?: number): string {
  return companyId != null && companyId > 0 ? `?company_id=${companyId}` : "";
}

function companyBody(payload: Pick<OnlineStoragePayload, "company_id" | "companyId">): { company_id?: number } {
  const id = Number(payload.company_id ?? payload.companyId);
  return Number.isFinite(id) && id > 0 ? { company_id: id } : {};
}

export function getOnlineStorageById(id: number, options?: { auth?: boolean; companyId?: number }) {
  return apiRequest<OnlineStorage>(`/onlinestorage/getby/${id}${companyQuery(options?.companyId)}`, {
    method: "GET",
    auth: options?.auth ?? true,
    fallbackError: "PDF shablonni yuklab bo'lmadi",
  }).then(raw => {
    const analysis_id = resolveOnlineStorageAnalysisId(raw);
    return analysis_id != null ? { ...raw, analysis_id } : raw;
  });
}

/** SMS / public link — token talab qilinmaydi */
export function getOnlineStorageByIdTwo(id: number) {
  return apiRequest<OnlineStorage>(`/onlinestorage/getbytwo/${id}`, {
    method: "GET",
    auth: false,
    fallbackError: "PDF shablonni yuklab bo'lmadi",
  }).then(raw => {
    const analysis_id = resolveOnlineStorageAnalysisId(raw);
    return analysis_id != null ? { ...raw, analysis_id } : raw;
  });
}

export function addOnlineStorage(payload: OnlineStoragePayload) {
  return apiRequest<OnlineStorage>("/onlinestorage/add", {
    method: "POST",
    body: {
      name: payload.name,
      analysis_id: Number(payload.analysis_id),
      text: typeof payload.text === "string" ? payload.text : JSON.stringify(payload.text ?? {}),
      ...companyBody(payload),
    },
    fallbackError: "PDF shablon qo'shib bo'lmadi",
  });
}

export function updateOnlineStorage(id: number, payload: OnlineStoragePayload) {
  const company = companyBody(payload);
  return apiRequest<OnlineStorage>(`/onlinestorage/update/${id}${companyQuery(company.company_id)}`, {
    method: "PATCH",
    body: {
      name: payload.name,
      analysis_id: Number(payload.analysis_id),
      text: typeof payload.text === "string" ? payload.text : JSON.stringify(payload.text ?? {}),
      ...company,
    },
    fallbackError: "PDF shablonni yangilab bo'lmadi",
  });
}

export function deleteOnlineStorage(id: number, companyId?: number) {
  return apiRequest<unknown>(`/onlinestorage/delete/${id}${companyQuery(companyId)}`, {
    method: "DELETE",
    fallbackError: "PDF shablonni o'chirib bo'lmadi",
  });
}
