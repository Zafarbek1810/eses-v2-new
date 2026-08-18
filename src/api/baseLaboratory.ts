import { apiRequest } from "./client";

export type BaseLaboratory = {
  id: number;
  name: string;
  createdAt?: string;
  analysis?: unknown[];
};

export type BaseLaboratoryPayload = {
  name: string;
};

export type BaseLaboratoriesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type BaseLaboratoriesFullResponse = {
  data: BaseLaboratory[];
  total: number;
  page: number;
  limit: number;
};

function normalizeList(raw: unknown): BaseLaboratory[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.baselaboratories ?? obj.laboratories ?? obj.items ?? obj.result;
    if (Array.isArray(data)) list = data;
  }

  return list.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const obj = item as Record<string, unknown>;
    const id = Number(obj.id);
    if (!Number.isFinite(id)) return [];
    return [{
      id,
      name: String(obj.name ?? ""),
      createdAt: String(obj.createdAt ?? obj.created_at ?? ""),
      analysis: Array.isArray(obj.baseanalysis)
        ? obj.baseanalysis
        : Array.isArray(obj.baseanalyses)
          ? obj.baseanalyses
          : Array.isArray(obj.analysis)
            ? obj.analysis
            : [],
    }];
  });
}

function normalizeFullResponse(
  raw: unknown,
  params: BaseLaboratoriesFullParams,
): BaseLaboratoriesFullResponse {
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

export async function getAllBaseLaboratories() {
  const raw = await apiRequest<unknown>("/baselaboratory/getall", {
    method: "GET",
    fallbackError: "Global laboratoriyalarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getBaseLaboratoriesFull(
  params: BaseLaboratoriesFullParams = {},
): Promise<BaseLaboratoriesFullResponse> {
  const query = new URLSearchParams();
  if (params.page != null) query.set("page", String(params.page));
  if (params.limit != null) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  const qs = query.toString();
  const raw = await apiRequest<unknown>(`/baselaboratory/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Global laboratoriyalarni yuklab bo'lmadi",
  });
  return normalizeFullResponse(raw, params);
}

export function getBaseLaboratoryById(id: number) {
  return apiRequest<BaseLaboratory>(`/baselaboratory/getby/${id}`, {
    method: "GET",
    fallbackError: "Global laboratoriyani yuklab bo'lmadi",
  });
}

export function addBaseLaboratory(payload: BaseLaboratoryPayload) {
  return apiRequest<BaseLaboratory>("/baselaboratory/add", {
    method: "POST",
    body: payload,
    fallbackError: "Global laboratoriya qo'shib bo'lmadi",
  });
}

export function updateBaseLaboratory(id: number, payload: Partial<BaseLaboratoryPayload>) {
  return apiRequest<BaseLaboratory>(`/baselaboratory/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Global laboratoriyani yangilab bo'lmadi",
  });
}

export function deleteBaseLaboratory(id: number) {
  return apiRequest<unknown>(`/baselaboratory/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Global laboratoriyani o'chirib bo'lmadi",
  });
}
