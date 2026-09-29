import { apiRequest } from "./client";

export type SanminPaymentMethod = "cash" | "card" | "click" | "transfer" | string;
export type SanminPaymentStatus = "paid" | "unpaid" | "pending" | string;

export type Sanmin = {
  id: number;
  name: string;
  description: string;
  phone: string;
  workplace: string;
  payment_method: SanminPaymentMethod;
  payment_status: SanminPaymentStatus;
  price: string | number;
  createdAt?: string;
  updatedAt?: string;
};

export type SanminPayload = {
  name: string;
  description: string;
  phone: string;
  workplace: string;
  payment_method: SanminPaymentMethod;
  payment_status: SanminPaymentStatus;
  price: string;
};

export type SanminUpdatePayload = Partial<SanminPayload>;

export type SanminFullParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export type SanminFullResponse = {
  data: Sanmin[];
  total: number;
  page: number;
  limit: number;
};

export type SanminTotalAmountRangeParams = {
  search?: string;
  payment_method?: string;
  payment_status?: string;
  startDate?: string;
  endDate?: string;
};

export type SanminTotalAmountRange = {
  totalAmount: number;
  count: number;
};

function normalizeFullResponse(
  raw: unknown,
  params: SanminFullParams,
): SanminFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Sanmin[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.sanmins ?? obj.items ?? obj.result) as
      | Sanmin[]
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

function normalizeTotalAmountRange(raw: unknown): SanminTotalAmountRange {
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

export function getAllSanmins() {
  return apiRequest<Sanmin[]>("/sanmin/getall", {
    method: "GET",
    fallbackError: "San minimumlarni yuklab bo'lmadi",
  });
}

export async function getSanminsFull(
  params: SanminFullParams = {},
): Promise<SanminFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(`/sanmin/getfull${qs ? `?${qs}` : ""}`, {
    method: "GET",
    fallbackError: "San minimumlarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export function getSanminById(id: number) {
  return apiRequest<Sanmin>(`/sanmin/getby/${id}`, {
    method: "GET",
    fallbackError: "San minimumni yuklab bo'lmadi",
  });
}

export function addSanmin(payload: SanminPayload) {
  return apiRequest<Sanmin>("/sanmin/add", {
    method: "POST",
    body: payload,
    fallbackError: "San minimumni qo'shib bo'lmadi",
  });
}

export function updateSanmin(id: number, payload: SanminUpdatePayload) {
  return apiRequest<Sanmin>(`/sanmin/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "San minimumni yangilab bo'lmadi",
  });
}

export function deleteSanmin(id: number) {
  return apiRequest<unknown>(`/sanmin/delete/${id}`, {
    method: "DELETE",
    fallbackError: "San minimumni o'chirib bo'lmadi",
  });
}

export async function getSanminTotalAmountRange(
  params: SanminTotalAmountRangeParams = {},
): Promise<SanminTotalAmountRange> {
  const q = new URLSearchParams();
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.payment_method?.trim()) q.set("payment_method", params.payment_method.trim());
  if (params.payment_status?.trim()) q.set("payment_status", params.payment_status.trim());
  if (params.startDate?.trim()) q.set("startDate", params.startDate.trim());
  if (params.endDate?.trim()) q.set("endDate", params.endDate.trim());

  const qs = q.toString();
  const raw = await apiRequest<unknown>(
    `/sanmin/totalamountrange${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      fallbackError: "San minimum statistikasini yuklab bo'lmadi",
    },
  );

  return normalizeTotalAmountRange(raw);
}
