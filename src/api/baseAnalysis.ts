import { apiRequest } from "./client";
import type { BaseLaboratory } from "./baseLaboratory";

export type BaseAnalysis = {
  id: number;
  name: string;
  shortname: string;
  price: string;
  globalstorage: boolean;
  createdAt?: string;
  baselaboratory: BaseLaboratory | null;
  baselaboratory_id?: number;
};

export type BaseAnalysisPayload = {
  name: string;
  shortname: string;
  price: string;
  globalstorage: boolean;
  baselaboratory_id: number;
};

export type BaseAnalysesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type BaseAnalysesFullResponse = {
  data: BaseAnalysis[];
  total: number;
  page: number;
  limit: number;
};

function toBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  return typeof value === "string" && (value.toLowerCase() === "true" || value === "1");
}

function normalizeLaboratory(raw: unknown): BaseLaboratory | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const id = Number(obj.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(obj.name ?? ""),
    createdAt: String(obj.createdAt ?? obj.created_at ?? ""),
  };
}

function normalizeList(raw: unknown): BaseAnalysis[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.baseanalyses ?? obj.analyses ?? obj.items ?? obj.result;
    if (Array.isArray(data)) list = data;
  }

  return list.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    const id = Number(obj.id);
    if (!Number.isFinite(id)) return [];
    const labId = Number(obj.baselaboratory_id ?? obj.baseLaboratoryId);
    const baselaboratory = normalizeLaboratory(
      obj.baselaboratory ?? obj.baseLaboratory ?? obj.laboratory,
    ) ?? (Number.isFinite(labId) && labId > 0
      ? { id: labId, name: String(obj.baselaboratory_name ?? ""), createdAt: "" }
      : null);

    return [{
      id,
      name: String(obj.name ?? ""),
      shortname: String(obj.shortname ?? obj.shortName ?? ""),
      price: String(obj.price ?? ""),
      globalstorage: toBoolean(obj.globalstorage ?? obj.globalStorage),
      createdAt: String(obj.createdAt ?? obj.created_at ?? ""),
      baselaboratory,
      baselaboratory_id: baselaboratory?.id,
    }];
  });
}

function normalizeFullResponse(
  raw: unknown,
  params: BaseAnalysesFullParams,
): BaseAnalysesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const data = normalizeList(raw);
  if (Array.isArray(raw)) return { data, total: data.length, page, limit };

  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;
  const totalValue = obj.total ?? obj.count ?? obj.totalCount ?? meta?.total;
  return {
    data,
    total: typeof totalValue === "number" ? totalValue : data.length,
    page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
    limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
  };
}

export async function getAllBaseAnalyses() {
  const raw = await apiRequest<unknown>("/baseanalysis/getall", {
    method: "GET",
    fallbackError: "Global analizlarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getBaseAnalysesFull(
  params: BaseAnalysesFullParams = {},
): Promise<BaseAnalysesFullResponse> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  const qs = query.toString();
  const raw = await apiRequest<unknown>(`/baseanalysis/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Global analizlarni yuklab bo'lmadi",
  });
  return normalizeFullResponse(raw, params);
}

export function getBaseAnalysisById(id: number) {
  return apiRequest<BaseAnalysis>(`/baseanalysis/getby/${id}`, {
    method: "GET",
    fallbackError: "Global analizni yuklab bo'lmadi",
  });
}

export function addBaseAnalysis(payload: BaseAnalysisPayload) {
  return apiRequest<BaseAnalysis>("/baseanalysis/add", {
    method: "POST",
    body: payload,
    fallbackError: "Global analiz qo'shib bo'lmadi",
  });
}

export function updateBaseAnalysis(id: number, payload: Partial<BaseAnalysisPayload>) {
  return apiRequest<BaseAnalysis>(`/baseanalysis/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Global analizni yangilab bo'lmadi",
  });
}

export function deleteBaseAnalysis(id: number) {
  return apiRequest<unknown>(`/baseanalysis/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Global analizni o'chirib bo'lmadi",
  });
}
