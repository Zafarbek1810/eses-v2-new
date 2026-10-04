import { apiRequest } from "./client";

export type DealPaymentMethod = "cash" | "card" | "click" | "transfer" | string;
export type DealPaymentStatus = "paid" | "unpaid" | "pending" | string;

export type Deal = {
  id: number;
  name: string;
  number: string;
  amount: string | number;
  owner_name: string;
  payment_method: DealPaymentMethod;
  payment_status: DealPaymentStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type DealPayload = {
  name: string;
  number: string;
  amount: string;
  owner_name: string;
  payment_method: DealPaymentMethod;
  payment_status: DealPaymentStatus;
};

export type DealUpdatePayload = Partial<DealPayload>;

export type DealFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type DealFullResponse = {
  data: Deal[];
  total: number;
  page: number;
  limit: number;
};

export type DealTotalAmountRangeParams = {
  search?: string;
  payment_method?: string;
  payment_status?: string;
  startDate?: string;
  endDate?: string;
};

export type DealTotalAmountRange = {
  totalAmount: number;
  count: number;
};

function unwrapDeal(raw: unknown): Deal {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const nested = obj.data ?? obj.deal ?? obj.result;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as Deal;
    }
  }
  return raw as Deal;
}

function unwrapDealList(raw: unknown): Deal[] {
  if (Array.isArray(raw)) return raw as Deal[];
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = obj.data ?? obj.deals ?? obj.items ?? obj.result;
    if (Array.isArray(data)) return data as Deal[];
  }
  return [];
}

function normalizeFullResponse(
  raw: unknown,
  params: DealFullParams,
): DealFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Deal[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.deals ?? obj.items ?? obj.result) as
      | Deal[]
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

function normalizeTotalAmountRange(raw: unknown): DealTotalAmountRange {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : obj;

  const amount = Number(
    nested.totalAmount
      ?? nested.total_amount
      ?? nested.totalFinalAmount
      ?? nested.total_final_amount
      ?? nested.total
      ?? 0,
  );
  const count = Number(nested.count ?? nested.totalCount ?? 0);

  return {
    totalAmount: Number.isFinite(amount) ? amount : 0,
    count: Number.isFinite(count) ? count : 0,
  };
}

export async function getAllDeals(): Promise<Deal[]> {
  const raw = await apiRequest<unknown>("/deal/getall", {
    method: "GET",
    fallbackError: "Shartnomalarni yuklab bo'lmadi",
  });
  return unwrapDealList(raw);
}

export async function getDealsFull(
  params: DealFullParams = {},
): Promise<DealFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/deal/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "Shartnomalarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export async function getDealById(id: number): Promise<Deal> {
  const raw = await apiRequest<unknown>(`/deal/getby/${id}`, {
    method: "GET",
    fallbackError: "Shartnomani yuklab bo'lmadi",
  });
  return unwrapDeal(raw);
}

export function addDeal(payload: DealPayload) {
  return apiRequest<Deal>("/deal/add", {
    method: "POST",
    body: payload,
    fallbackError: "Shartnomani qo'shib bo'lmadi",
  });
}

export function updateDeal(id: number, payload: DealUpdatePayload) {
  return apiRequest<Deal>(`/deal/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Shartnomani yangilab bo'lmadi",
  });
}

export function deleteDeal(id: number) {
  return apiRequest<unknown>(`/deal/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Shartnomani o'chirib bo'lmadi",
  });
}

export async function getDealTotalAmountRange(
  params: DealTotalAmountRangeParams = {},
): Promise<DealTotalAmountRange> {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.payment_method?.trim()) q.set("payment_method", params.payment_method.trim());
  if (params.payment_status?.trim()) q.set("payment_status", params.payment_status.trim());
  if (params.startDate?.trim()) q.set("startDate", params.startDate.trim());
  if (params.endDate?.trim()) q.set("endDate", params.endDate.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(
    `/deal/totalamountrange${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      fallbackError: "Shartnoma statistikasini yuklab bo'lmadi",
    },
  );

  return normalizeTotalAmountRange(raw);
}
