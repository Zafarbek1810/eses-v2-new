import { apiRequest } from "./client";

export type UserRole = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
} | null;

export type UserCompany = {
  id: number;
  name: string;
  description: string;
  address: string;
  createdAt: string;
} | null;

export type AppUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  password?: string;
  createdAt: string;
  role: UserRole;
  company?: UserCompany;
};

export type UserPayload = {
  username: string;
  surname: string;
  email: string;
  password: string;
  role_id: number;
  company_id?: number;
};

export type UserUpdatePayload = {
  username: string;
  surname: string;
  email: string;
  role_id?: number;
  password?: string;
  company_id?: number;
};

export type UsersFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number;
};

export type UsersFullResponse = {
  data: AppUser[];
  total: number;
  page: number;
  limit: number;
};

function normalizeFullResponse(raw: unknown, params: UsersFullParams): UsersFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as AppUser[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.users ?? obj.items ?? obj.result) as AppUser[] | undefined;
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

function mergeUsersWithDetails(pageUsers: AppUser[], details: AppUser[]): AppUser[] {
  if (!details.length) return pageUsers;

  const byId = new Map(details.map(u => [u.id, u]));
  return pageUsers.map(user => {
    const full = byId.get(user.id);
    if (!full) return user;
    return {
      ...user,
      role: full.role ?? user.role ?? null,
      company: full.company ?? user.company ?? null,
    };
  });
}

export function getAllUsers(companyId?: number) {
  const query = companyId != null ? `?company_id=${companyId}` : "";
  return apiRequest<AppUser[]>(`/user/getall${query}`, {
    method: "GET",
    fallbackError: "Foydalanuvchilarni yuklab bo'lmadi",
  });
}

export async function getUsersFull(params: UsersFullParams = {}): Promise<UsersFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.companyId != null) q.set("company_id", String(params.companyId));

  const qs = q.toString();

  const [raw, detailsResult] = await Promise.all([
    apiRequest<unknown>(`/user/getfull${qs ? `?${qs}` : ""}`, {
      method: "GET",
      fallbackError: "Foydalanuvchilarni yuklab bo'lmadi",
    }),
    getAllUsers(params.companyId).catch(() => [] as AppUser[]),
  ]);

  const page = normalizeFullResponse(raw, params);
  const details = Array.isArray(detailsResult) ? detailsResult : [];

  return {
    ...page,
    data: mergeUsersWithDetails(page.data, details),
  };
}

export function getUserById(id: number) {
  return apiRequest<AppUser>(`/user/getby/${id}`, {
    method: "GET",
    fallbackError: "Foydalanuvchini yuklab bo'lmadi",
  });
}

export function addUser(payload: UserPayload) {
  return apiRequest<AppUser>("/user/add", {
    method: "POST",
    body: payload,
    fallbackError: "Foydalanuvchi qo'shib bo'lmadi",
  });
}

export function updateUser(id: number, payload: UserUpdatePayload) {
  return apiRequest<AppUser>(`/user/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Foydalanuvchini yangilab bo'lmadi",
  });
}

export function deleteUser(id: number) {
  return apiRequest<unknown>(`/user/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Foydalanuvchini o'chirib bo'lmadi",
  });
}
