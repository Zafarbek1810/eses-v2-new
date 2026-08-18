import { apiRequest } from "./client";

export type AnalysisLaboratory = {
  id: number;
  name: string;
  createdAt: string;
  lab_director: unknown;
} | null;

export type Analysis = {
  id: number;
  name: string;
  shortname: string;
  price: string;
  createdAt: string;
  laboratory: AnalysisLaboratory;
  /** PDF shablon mavjudligi (`/onlinestorage`) */
  onlinestorage?: boolean;
  onlineStorage?: boolean;
  company_id?: number | null;
  companyId?: number | null;
  company?: { id: number; name?: string } | null;
};

export type AnalysisPayload = {
  name: string;
  shortname: string;
  price: string;
  laboratory_id: number;
  company_id?: number;
};

/** Partial PATCH body — e.g. only `{ onlinestorage: true }` after template save */
export type AnalysisUpdatePayload = Partial<AnalysisPayload> & {
  onlinestorage?: boolean;
  company_id?: number;
};

export function analysisHasOnlineStorage(a: Analysis | null | undefined): boolean {
  if (!a || typeof a !== "object") return false;
  const v = (a as Record<string, unknown>).onlinestorage
    ?? (a as Record<string, unknown>).onlineStorage
    ?? (a as Record<string, unknown>).online_storage;
  if (v === true || v === 1) return true;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

export type AnalysesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number;
};

export type AnalysesFullResponse = {
  data: Analysis[];
  total: number;
  page: number;
  limit: number;
};

function normalizeLaboratory(raw: unknown): AnalysisLaboratory {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(o.name ?? ""),
    createdAt: String(o.createdAt ?? o.created_at ?? ""),
    lab_director: o.lab_director ?? null,
  };
}

function normalizeAnalysisRecord(raw: unknown): Analysis | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const laboratory =
    normalizeLaboratory(o.laboratory ?? o.lab) ??
    (() => {
      const labId = Number(o.laboratory_id ?? o.laboratoryId ?? o.lab_id ?? o.labId);
      if (!Number.isFinite(labId) || labId <= 0) {
        // ba'zi API lar laboratory ni oddiy id (number) qilib qaytaradi
        if (typeof o.laboratory === "number" || typeof o.lab === "number") {
          const bare = Number(o.laboratory ?? o.lab);
          if (Number.isFinite(bare) && bare > 0) {
            return { id: bare, name: "", createdAt: "", lab_director: null };
          }
        }
        return null;
      }
      return {
        id: labId,
        name: String(o.laboratory_name ?? o.laboratoryName ?? ""),
        createdAt: "",
        lab_director: null,
      };
    })();

  return {
    id,
    name: String(o.name ?? ""),
    shortname: String(o.shortname ?? o.shortName ?? ""),
    price: String(o.price ?? ""),
    createdAt: String(o.createdAt ?? o.created_at ?? ""),
    laboratory,
    onlinestorage: analysisHasOnlineStorage(o as unknown as Analysis),
    company_id: Number.isFinite(Number(o.company_id)) ? Number(o.company_id) : null,
    companyId: Number.isFinite(Number(o.companyId)) ? Number(o.companyId) : null,
    company:
      o.company && typeof o.company === "object"
        ? {
            id: Number((o.company as Record<string, unknown>).id),
            name: String((o.company as Record<string, unknown>).name ?? ""),
          }
        : null,
  };
}

function normalizeAnalysisList(raw: unknown): Analysis[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.analyses ?? obj.analysis ?? obj.items ?? obj.result;
    if (Array.isArray(data)) {
      list = data;
    } else if (data && typeof data === "object") {
      const nested = data as Record<string, unknown>;
      const nestedList = nested.analyses ?? nested.analysis ?? nested.items ?? nested.data;
      if (Array.isArray(nestedList)) list = nestedList;
    }
  }
  return list
    .map(normalizeAnalysisRecord)
    .filter((a): a is Analysis => a != null);
}

function normalizeFullResponse(
  raw: unknown,
  params: AnalysesFullParams,
): AnalysesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    const data = normalizeAnalysisList(raw);
    return { data, total: data.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = normalizeAnalysisList(
      obj.data ?? obj.analyses ?? obj.items ?? obj.result ?? [],
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
      page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
      limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export async function getAllAnalyses(companyId?: number) {
  const query = companyId != null ? `?company_id=${companyId}` : "";
  const raw = await apiRequest<unknown>(`/analysis/getall${query}`, {
    method: "GET",
    fallbackError: "Analizlarni yuklab bo'lmadi",
  });
  return normalizeAnalysisList(raw);
}

export async function getAnalysesFull(
  params: AnalysesFullParams = {},
): Promise<AnalysesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.companyId != null) q.set("company_id", String(params.companyId));

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/analysis/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Analizlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getAnalysisById(id: number, companyId?: number) {
  const query = companyId != null ? `?company_id=${companyId}` : "";
  return apiRequest<unknown>(`/analysis/getby/${id}${query}`, {
    method: "GET",
    fallbackError: "Analizni yuklab bo'lmadi",
  }).then(raw => normalizeAnalysisRecord(raw) ?? (raw as Analysis));
}

export async function addAnalysis(payload: AnalysisPayload) {
  const companyId = Number(payload.company_id);
  const body: Record<string, unknown> = {
    name: payload.name,
    shortname: payload.shortname,
    price: payload.price,
    laboratory_id: Number(payload.laboratory_id),
  };
  if (Number.isFinite(companyId) && companyId > 0) body.company_id = companyId;

  const raw = await apiRequest<unknown>("/analysis/add", {
    method: "POST",
    body,
    fallbackError: "Analiz qo'shib bo'lmadi",
  });
  const item = normalizeAnalysisRecord(raw);
  if (item) {
    return {
      ...item,
      company_id: item.company_id ?? (Number.isFinite(companyId) && companyId > 0 ? companyId : item.company_id),
      companyId: item.companyId ?? (Number.isFinite(companyId) && companyId > 0 ? companyId : item.companyId),
    };
  }
  return raw as Analysis;
}

export function updateAnalysis(id: number, payload: AnalysisUpdatePayload) {
  const body: Record<string, unknown> = {};
  if (payload.name != null) body.name = payload.name;
  if (payload.shortname != null) body.shortname = payload.shortname;
  if (payload.price != null) body.price = payload.price;
  if (payload.onlinestorage != null) body.onlinestorage = payload.onlinestorage;
  if (payload.company_id != null && payload.company_id > 0) body.company_id = payload.company_id;
  if (payload.laboratory_id != null) {
    const labId = Number(payload.laboratory_id);
    if (Number.isFinite(labId) && labId > 0) body.laboratory_id = labId;
  }
  return apiRequest<Analysis>(`/analysis/update/${id}`, {
    method: "PATCH",
    body,
    fallbackError: "Analizni yangilab bo'lmadi",
  });
}

export function deleteAnalysis(id: number, companyId?: number) {
  const query = companyId != null && companyId > 0 ? `?company_id=${companyId}` : "";
  return apiRequest<unknown>(`/analysis/delete/${id}${query}`, {
    method: "DELETE",
    fallbackError: "Analizni o'chirib bo'lmadi",
  });
}
