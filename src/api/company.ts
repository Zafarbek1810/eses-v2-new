import { apiRequest } from "./client";

export type CompanyUserRole = {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
};

export type CompanyUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  createdAt?: string;
  role?: CompanyUserRole | null;
};

export type CompanyRegion = {
  id: number;
  name: string;
  createdAt?: string;
};

export type CompanyDistrict = {
  id: number;
  name: string;
  createdAt?: string;
};

export type Company = {
  id: number;
  name: string;
  description: string;
  address: string;
  phone: string;
  /** Backend qo'shilgach PDF "Shablon usti adress" da ishlatiladi */
  fax?: string | null;
  website?: string | null;
  telegram?: string | null;
  active: boolean;
  user?: CompanyUser[];
  region?: CompanyRegion | null;
  district?: CompanyDistrict | null;
  /** Some API payloads expose FK without nested district object. */
  districtId?: number | null;
  district_id?: number | null;
  createdAt: string;
};

/** Find the company employee with role name "director". */
export function findCompanyDirector(company: Company): CompanyUser | null {
  const users = company.user;
  if (!Array.isArray(users)) return null;
  return (
    users.find(u => {
      const name = u.role?.name?.trim().toLowerCase();
      return name === "director";
    }) ?? null
  );
}

export type CompanyPayload = {
  name: string;
  description: string;
  address: string;
  phone: string;
  active: boolean;
  region_id: number;
  district_id?: number;
};

export type CompaniesFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type CompaniesFullResponse = {
  data: Company[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: CompaniesFullParams,
): CompaniesFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Company[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.companies ?? obj.items ?? obj.result) as
      | Company[]
      | undefined;
    const total =
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.count === "number"
          ? obj.count
          : typeof obj.totalCount === "number"
            ? obj.totalCount
            : Array.isArray(data)
              ? data.length
              : 0;
    const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;

    return {
      data: Array.isArray(data) ? data : [],
      total: typeof meta?.total === "number" ? meta.total : total,
      page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
      limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
    };
  }

  return { data: [], total: 0, page, limit };
}

export function extractCompanyId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.id ??
    (obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>).id : undefined) ??
    (obj.company && typeof obj.company === "object" ? (obj.company as Record<string, unknown>).id : undefined);
  return typeof candidate === "number" ? candidate : null;
}

export function getAllCompanies() {
  return apiRequest<Company[]>("/company/getall", {
    method: "GET",
    fallbackError: "Tashkilotlarni yuklab bo'lmadi",
  });
}

export async function getCompaniesFull(
  params: CompaniesFullParams = {},
): Promise<CompaniesFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/company/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Tashkilotlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function unwrapCompany(raw: unknown): Company {
  if (!raw || typeof raw !== "object") return raw as Company;
  const obj = raw as Record<string, unknown>;
  const nested = [obj.data, obj.company, obj.result].find(
    item => item && typeof item === "object" && !Array.isArray(item) && "id" in (item as object),
  ) as Record<string, unknown> | undefined;

  const base = (
    typeof obj.id === "number" && Number.isFinite(obj.id) && obj.id > 0
      ? obj
      : nested ?? obj
  ) as Record<string, unknown>;

  const extra = nested && nested !== base ? nested : undefined;
  const user = base.user ?? base.users ?? extra?.user ?? extra?.users;
  const role = base.role ?? extra?.role;
  const roles = base.roles ?? extra?.roles;

  return {
    ...(extra ?? {}),
    ...base,
    ...(Array.isArray(user) ? { user } : {}),
    ...(role !== undefined ? { role } : {}),
    ...(roles !== undefined ? { roles } : {}),
  } as Company;
}

export async function getCompanyById(id: number) {
  const raw = await apiRequest<unknown>(`/company/getby/${id}`, {
    method: "GET",
    fallbackError: "Tashkilotni yuklab bo'lmadi",
  });
  return unwrapCompany(raw);
}

export function addCompany(payload: CompanyPayload) {
  return apiRequest<Company>("/company/add", {
    method: "POST",
    body: payload,
    fallbackError: "Tashkilot qo'shib bo'lmadi",
  });
}

export function updateCompany(id: number, payload: CompanyPayload) {
  return apiRequest<Company>(`/company/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Tashkilotni yangilab bo'lmadi",
  });
}

export function deleteCompany(id: number) {
  return apiRequest<unknown>(`/company/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Tashkilotni o'chirib bo'lmadi",
  });
}
