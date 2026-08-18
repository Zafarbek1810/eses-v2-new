import { apiRequest } from "./client";

export type LabAssistant = {
  id: number;
  username?: string;
  surname?: string;
  email?: string;
  [key: string]: unknown;
};

export type LabDirector = LabAssistant | null;

export type Laboratory = {
  id: number;
  name: string;
  createdAt: string;
  analysis: unknown[];
  lab_director: LabDirector;
  lab_assistants: LabAssistant[];
  company_id?: number | null;
  companyId?: number | null;
  company?: { id: number; name?: string } | null;
};

export type LaboratoryPayload = {
  name: string;
  company_id?: number;
};

export type LaboratoryUpdatePayload = {
  name?: string;
  lab_director_id?: number | null;
  company_id?: number;
  companyId?: number;
  company?: { id: number };
};

export type LaboratoriesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number;
};

export type LaboratoriesFullResponse = {
  data: Laboratory[];
  total: number;
  page: number;
  limit: number;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : null;
}

function extractLaboratoryArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  const candidates = [
    obj.data,
    obj.laboratories,
    obj.laboratory,
    obj.labs,
    obj.items,
    obj.result,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  const nested = asRecord(obj.data) ?? asRecord(obj.result);
  if (nested) {
    const nestedList = nested.laboratories ?? nested.laboratory ?? nested.labs ?? nested.items ?? nested.data;
    if (Array.isArray(nestedList)) return nestedList;
  }
  return [];
}

function normalizeLaboratoryRecord(raw: unknown): Laboratory | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const nested = asRecord(obj.laboratory) ?? obj;
  const id = Number(nested.id ?? obj.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const company = asRecord(nested.company ?? obj.company);
  const companyIdRaw = nested.company_id ?? nested.companyId ?? obj.company_id ?? obj.companyId ?? company?.id;
  const companyId = Number(companyIdRaw);
  return {
    id,
    name: String(nested.name ?? obj.name ?? ""),
    createdAt: String(nested.createdAt ?? nested.created_at ?? obj.createdAt ?? obj.created_at ?? ""),
    analysis: Array.isArray(nested.analysis)
      ? nested.analysis
      : Array.isArray(obj.analysis)
        ? obj.analysis
        : [],
    lab_director: (nested.lab_director ?? obj.lab_director ?? null) as LabDirector,
    lab_assistants: Array.isArray(nested.lab_assistants)
      ? nested.lab_assistants as LabAssistant[]
      : Array.isArray(obj.lab_assistants)
        ? obj.lab_assistants as LabAssistant[]
        : [],
    company_id: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
    companyId: Number.isFinite(companyId) && companyId > 0 ? companyId : null,
    company: company && Number.isFinite(Number(company.id))
      ? { id: Number(company.id), name: String(company.name ?? "") }
      : null,
  };
}

function normalizeLaboratoryList(raw: unknown): Laboratory[] {
  return extractLaboratoryArray(raw)
    .map(normalizeLaboratoryRecord)
    .filter((lab): lab is Laboratory => lab != null);
}

function normalizeFullResponse(
  raw: unknown,
  params: LaboratoriesFullParams,
): LaboratoriesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const data = normalizeLaboratoryList(raw);
  const obj = asRecord(raw);
  const total =
    typeof obj?.total === "number"
      ? obj.total
      : typeof obj?.count === "number"
        ? obj.count
        : typeof obj?.totalCount === "number"
          ? obj.totalCount
          : data.length;
  const meta = asRecord(obj?.meta ?? obj?.pagination);

  return {
    data,
    total: typeof meta?.total === "number" ? meta.total : total,
    page: typeof obj?.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
    limit: typeof obj?.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
  };
}

export async function getAllLaboratories(companyId?: number) {
  // Super admin boshqa tashkilotni ko'rganda /getall JWT company_id ni
  // query dan ustun qo'yadi. /getfull esa query company_id ni oladi.
  if (companyId != null && companyId > 0) {
    const all: Laboratory[] = [];
    let page = 1;
    const limit = 200;
    for (;;) {
      const res = await getLaboratoriesFull({ companyId, page, limit });
      all.push(...(Array.isArray(res.data) ? res.data : []));
      if (all.length >= res.total || res.data.length < limit || page >= 50) break;
      page += 1;
    }
    return all;
  }

  return apiRequest<unknown>("/laboratory/getall", {
    method: "GET",
    fallbackError: "Laboratoriyalarni yuklab bo'lmadi",
  }).then(normalizeLaboratoryList);
}

export async function getLaboratoriesFull(
  params: LaboratoriesFullParams = {},
): Promise<LaboratoriesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.companyId != null) q.set("company_id", String(params.companyId));

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/laboratory/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Laboratoriyalarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getLaboratoryById(id: number, companyId?: number) {
  const query = companyId != null ? `?company_id=${companyId}` : "";
  return apiRequest<unknown>(`/laboratory/getby/${id}${query}`, {
    method: "GET",
    fallbackError: "Laboratoriyani yuklab bo'lmadi",
  }).then(raw => {
    const lab = normalizeLaboratoryRecord(raw);
    if (!lab) throw new Error("Laboratoriyani o'qib bo'lmadi");
    return lab;
  });
}

export async function addLaboratory(payload: LaboratoryPayload) {
  const companyId = Number(payload.company_id);
  const body: Record<string, unknown> = { name: payload.name };
  if (Number.isFinite(companyId) && companyId > 0) body.company_id = companyId;

  const raw = await apiRequest<unknown>("/laboratory/add", {
    method: "POST",
    body,
    fallbackError: "Laboratoriya qo'shib bo'lmadi",
  });
  const lab = normalizeLaboratoryRecord(raw);
  if (lab) {
    return {
      ...lab,
      company_id: lab.company_id ?? (Number.isFinite(companyId) && companyId > 0 ? companyId : lab.company_id),
      companyId: lab.companyId ?? (Number.isFinite(companyId) && companyId > 0 ? companyId : lab.companyId),
    };
  }
  return raw as Laboratory;
}

export function updateLaboratory(id: number, payload: LaboratoryUpdatePayload) {
  const body: Record<string, unknown> = {};
  if (payload.name != null) body.name = payload.name;
  if (payload.lab_director_id !== undefined) body.lab_director_id = payload.lab_director_id;
  if (payload.company_id != null && payload.company_id > 0) body.company_id = payload.company_id;
  return apiRequest<Laboratory>(`/laboratory/update/${id}`, {
    method: "PATCH",
    body,
    fallbackError: "Laboratoriyani yangilab bo'lmadi",
  });
}

export function deleteLaboratory(id: number, companyId?: number) {
  const query = companyId != null && companyId > 0 ? `?company_id=${companyId}` : "";
  return apiRequest<unknown>(`/laboratory/delete/${id}${query}`, {
    method: "DELETE",
    fallbackError: "Laboratoriyani o'chirib bo'lmadi",
  });
}

export function attachLabAssistant(labId: number, assistantId: number) {
  return apiRequest<unknown>(`/laboratory/assistant/${labId}/${assistantId}`, {
    method: "POST",
    fallbackError: "Assistentni biriktirib bo'lmadi",
  });
}

export function detachLabAssistant(labId: number, assistantId: number) {
  return apiRequest<unknown>(`/laboratory/assistant/${labId}/${assistantId}`, {
    method: "DELETE",
    fallbackError: "Assistentni olib tashlab bo'lmadi",
  });
}
