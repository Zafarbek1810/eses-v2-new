import type { Company } from "./company";
import type { Plan } from "./plan";
import { apiRequest } from "./client";

export type SubscriptionStatus = "ACTIVE" | "PENDING" | "EXPIRED" | "CANCELLED";

export type Subscription = {
  id: number;
  company_id?: number;
  plan_id?: number;
  companyId?: number;
  planId?: number;
  company?: Company | null;
  plan?: Plan | null;
  startDate: string;
  dueDate: string;
  status: SubscriptionStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type SubscriptionPayload = {
  company_id: number;
  plan_id: number;
  startDate: string;
  dueDate: string;
  status: SubscriptionStatus;
};

export type SubscriptionsFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type SubscriptionsFullResponse = {
  data: Subscription[];
  total: number;
  page: number;
  limit: number;
};

function normalizeList(raw: unknown): Subscription[] {
  if (Array.isArray(raw)) return raw as Subscription[];
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const data = obj.data ?? obj.subscriptions ?? obj.items ?? obj.result;
  return Array.isArray(data) ? data as Subscription[] : [];
}

function normalizeFull(
  raw: unknown,
  params: SubscriptionsFullParams,
): SubscriptionsFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  if (Array.isArray(raw)) {
    return { data: raw as Subscription[], total: raw.length, page, limit };
  }
  if (!raw || typeof raw !== "object") return { data: [], total: 0, page, limit };

  const obj = raw as Record<string, unknown>;
  const data = normalizeList(raw);
  const meta = (obj.meta ?? obj.pagination) as Record<string, unknown> | undefined;
  const totalCandidate = obj.total ?? obj.count ?? obj.totalCount ?? meta?.total;
  return {
    data,
    total: typeof totalCandidate === "number" ? totalCandidate : data.length,
    page: typeof obj.page === "number" ? obj.page : typeof meta?.page === "number" ? meta.page : page,
    limit: typeof obj.limit === "number" ? obj.limit : typeof meta?.limit === "number" ? meta.limit : limit,
  };
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const raw = await apiRequest<unknown>("/subscription/getall", {
    method: "GET",
    fallbackError: "Obunalarni yuklab bo'lmadi",
  });
  return normalizeList(raw);
}

export async function getSubscriptionsFull(
  params: SubscriptionsFullParams = {},
): Promise<SubscriptionsFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  const query = q.toString();
  const raw = await apiRequest<unknown>(`/subscription/getfull${query ? `?${query}` : ""}`, {
    method: "GET",
    fallbackError: "Obunalarni yuklab bo'lmadi",
  });
  return normalizeFull(raw, params);
}

export function getSubscriptionById(id: number) {
  return apiRequest<Subscription>(`/subscription/getby/${id}`, {
    method: "GET",
    fallbackError: "Obunani yuklab bo'lmadi",
  });
}

export function addSubscription(payload: SubscriptionPayload) {
  return apiRequest<Subscription>("/subscription/add", {
    method: "POST",
    body: payload,
    fallbackError: "Obunani qo'shib bo'lmadi",
  });
}

export function updateSubscription(id: number, payload: SubscriptionPayload) {
  return apiRequest<Subscription>(`/subscription/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Obunani yangilab bo'lmadi",
  });
}

export function deleteSubscription(id: number) {
  return apiRequest<unknown>(`/subscription/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Obunani o'chirib bo'lmadi",
  });
}
