import { apiRequest } from "./client";

export type OrderType = "patient" | "sample" | "course";
export type PaymentMethod = "cash" | "card" | "click";
export type PaymentStatus = "pending" | "paid" | "refunded";
export type OrderStatus = "pending" | "partially_completed" | "completed" | "canceled";
export type OrderItemStatus = "pending" | "in_progress" | "completed" | "canceled";

export type OrderItemPayload = {
  analysis_id: number;
  laboratory_id: number;
  price: number;
};

export type OrderPayload = {
  order_type: OrderType;
  payment_method: PaymentMethod;
  discount_percent: number | null;
  street: string | null;
  village: string | null;
  description: string | null;
  district_id: number | null;
  patient_id: number | null;
  owner_id: number;
  /** Tashkilot (sample) buyurtmalarida tashkilot nomi */
  name?: string | null;
  items: OrderItemPayload[];
};

export type OrderOwner = {
  id: number;
  username: string;
  surname: string;
  email: string;
  createdAt?: string;
};

export type OrderPatient = {
  id: number;
  first_name: string;
  last_name: string;
  birth_day?: string;
  phone?: string;
  sex?: number;
  street?: string;
  description?: string;
  village?: string;
  createdAt?: string;
};

export type OrderDistrict = {
  id: number;
  name: string;
  createdAt?: string;
};

export type OrderItemAnalysis = {
  id: number;
  name: string;
  shortname?: string;
  price?: string;
  createdAt?: string;
};

export type OrderItemLaboratory = {
  id: number;
  name: string;
  createdAt?: string;
};

export type OrderItem = {
  id: number;
  analysis_id?: number;
  analysisId?: number;
  analysis: OrderItemAnalysis | null;
  laboratory: OrderItemLaboratory | null;
  status: OrderItemStatus | string;
  updatedAt?: string;
  createdAt?: string;
};

export function resolveOrderItemAnalysisId(item: OrderItem): number | null {
  const raw = item.analysis?.id ?? item.analysis_id ?? item.analysisId;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type Order = {
  id: number;
  order_type: OrderType | string;
  name?: string | null;
  status: OrderStatus | string;
  payment_status: PaymentStatus | string;
  payment_method: PaymentMethod | string;
  total_amount?: string | number;
  discount_amount?: string | number;
  final_amount?: string | number;
  street?: string | null;
  description?: string | null;
  village?: string | null;
  district?: OrderDistrict | null;
  owner?: OrderOwner | null;
  patient?: OrderPatient | null;
  items?: OrderItem[];
  updatedAt?: string;
  createdAt?: string;
  [key: string]: unknown;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function extractOrderArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const obj = asRecord(raw);
  if (!obj) return [];
  const candidates = [obj.data, obj.orders, obj.items, obj.result];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  const nested = asRecord(obj.data) ?? asRecord(obj.result);
  if (nested) {
    const nestedList = nested.orders ?? nested.items ?? nested.data;
    if (Array.isArray(nestedList)) return nestedList;
  }
  return [];
}

function normalizeOrderItems(raw: Record<string, unknown>): OrderItem[] | undefined {
  const list = raw.items ?? raw.orderItems ?? raw.order_items ?? raw.orderItem;
  return Array.isArray(list) ? (list as OrderItem[]) : undefined;
}

/** patient | sample | course — API camelCase / tashkilot aliaslarini ham qabul qiladi */
export function resolveOrderType(
  order: Pick<Order, "order_type" | "name" | "patient"> & Record<string, unknown>,
): string {
  const raw = order.order_type ?? order.orderType ?? order.type;
  const t = String(raw ?? "").trim().toLowerCase();
  if (t === "organization" || t === "org" || t === "tashkilot") return "sample";
  if (t === "sample" || t === "patient" || t === "course") return t;
  if (!order.patient && String(order.name ?? "").trim()) return "sample";
  return "patient";
}

function normalizeOrder(raw: unknown): Order | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const id = Number(obj.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const items = normalizeOrderItems(obj);
  return {
    ...(obj as Order),
    id,
    order_type: resolveOrderType(obj as Order),
    ...(items ? { items } : {}),
  };
}

function normalizeOrderList(raw: unknown): Order[] {
  return extractOrderArray(raw)
    .map(normalizeOrder)
    .filter((order): order is Order => order != null);
}

export type OrdersFullParams = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  lab_id?: number;
};

export type OrdersFullResponse = {
  data: Order[];
  total: number;
  page: number;
  limit: number;
};

export type OrderUpdatePayload = Partial<{
  order_type: OrderType;
  payment_method: PaymentMethod;
  discount_percent: number | null;
  street: string | null;
  village: string | null;
  description: string | null;
  district_id: number | null;
  patient_id: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_sms: boolean;
  completed_sms: boolean;
  /** SMS dagi natija PDF havolasi (public /#/showresult/...) */
  result_link_sms: string;
}>;

function normalizeFullResponse(
  raw: unknown,
  params: OrdersFullParams,
): OrdersFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const data = normalizeOrderList(raw);

  if (Array.isArray(raw)) {
    return { data, total: data.length, page, limit };
  }

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

export async function getAllOrders() {
  const raw = await apiRequest<unknown>("/order/getall", {
    method: "GET",
    fallbackError: "Buyurtmalarni yuklab bo'lmadi",
  });
  return normalizeOrderList(raw);
}

export async function getOrdersFull(
  params: OrdersFullParams = {},
): Promise<OrdersFullResponse> {
  const q = new URLSearchParams();
  if (params.page != null) q.set("page", String(params.page));
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status?.trim()) q.set("status", params.status.trim());
  if (params.lab_id != null) q.set("lab_id", String(params.lab_id));

  const qs = q.toString();
  // Documented: /order/getfull/labid/?page&limit&search&status&lab_id=
  const path = `/order/getfull/labid${qs ? `?${qs}` : ""}`;

  const raw = await apiRequest<unknown>(path, {
    method: "GET",
    fallbackError: "Buyurtmalarni yuklab bo'lmadi",
  });

  return normalizeFullResponse(raw, params);
}

export async function getOrderById(id: number, options?: { auth?: boolean }) {
  const raw = await apiRequest<unknown>(`/order/getby/${id}`, {
    method: "GET",
    auth: options?.auth ?? true,
    fallbackError: "Buyurtmani yuklab bo'lmadi",
  });
  const obj = asRecord(raw);
  const inner = obj ? (obj.data ?? obj.order ?? obj.result ?? raw) : raw;
  const candidate = Array.isArray(inner) ? inner[0] : inner;
  const normalized = normalizeOrder(candidate) ?? normalizeOrder(raw);
  if (!normalized) throw new Error("Buyurtmani yuklab bo'lmadi");
  return normalized;
}

/** SMS / public link — token talab qilinmaydi */
export function getOrderByIdTwo(id: number) {
  return apiRequest<Order>(`/order/getbytwo/${id}`, {
    method: "GET",
    auth: false,
    fallbackError: "Buyurtmani yuklab bo'lmadi",
  });
}

export function addOrder(payload: OrderPayload) {
  return apiRequest<Order>("/order/add", {
    method: "POST",
    body: payload,
    fallbackError: "Order yaratib bo'lmadi",
  });
}

export function updateOrder(id: number, payload: OrderUpdatePayload) {
  return apiRequest<Order>(`/order/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Buyurtmani yangilab bo'lmadi",
  });
}

export function updateOrderStatus(id: number, status: OrderStatus | string) {
  return apiRequest<Order>(`/order/update/order/status/${id}`, {
    method: "PATCH",
    body: { status },
    fallbackError: "Buyurtma holatini yangilab bo'lmadi",
  });
}

export function recalculateOrderStatus(id: number) {
  return apiRequest<Order>(`/order/update/recalculate/status/${id}`, {
    method: "PATCH",
    fallbackError: "Holatni qayta hisoblab bo'lmadi",
  });
}

export function updatePaymentStatus(id: number, status: PaymentStatus | string) {
  return apiRequest<Order>(`/order/update/payment/status/${id}`, {
    method: "PATCH",
    body: { status },
    fallbackError: "To'lov holatini yangilab bo'lmadi",
  });
}

export function updateOrderItemStatus(id: number, status: OrderItemStatus | string) {
  return apiRequest<OrderItem>(`/order/update/item/status/${id}`, {
    method: "PATCH",
    body: { status },
    fallbackError: "Analiz holatini yangilab bo'lmadi",
  });
}

export function deleteOrder(id: number) {
  return apiRequest<unknown>(`/order/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Buyurtmani o'chirib bo'lmadi",
  });
}

export type OrderTotalAmountRangeParams = {
  startDate?: string;
  endDate?: string;
  status?: string;
  payment_method?: string;
  payment_status?: string;
  search?: string;
  lab_id?: number;
};

export type OrderTotalAmountRange = {
  totalFinalAmount: number;
  count: number;
};

function normalizeTotalAmountRange(raw: unknown): OrderTotalAmountRange {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const nested =
    obj.data && typeof obj.data === "object"
      ? (obj.data as Record<string, unknown>)
      : obj;

  const amount = Number(
    nested.totalFinalAmount ?? nested.total_final_amount ?? nested.totalAmount ?? 0,
  );
  const count = Number(nested.count ?? nested.totalCount ?? nested.total ?? 0);

  return {
    totalFinalAmount: Number.isFinite(amount) ? amount : 0,
    count: Number.isFinite(count) ? count : 0,
  };
}

/** Buyurtmalar jami summasi va soni (sana / lab_id / filtrlarga qarab). */
export async function getOrderTotalAmountRange(
  params: OrderTotalAmountRangeParams = {},
): Promise<OrderTotalAmountRange> {
  const q = new URLSearchParams();
  if (params.startDate?.trim()) q.set("startDate", params.startDate.trim());
  if (params.endDate?.trim()) q.set("endDate", params.endDate.trim());
  if (params.status?.trim()) q.set("status", params.status.trim());
  if (params.payment_method?.trim()) q.set("payment_method", params.payment_method.trim());
  if (params.payment_status?.trim()) q.set("payment_status", params.payment_status.trim());
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.lab_id != null) q.set("lab_id", String(params.lab_id));

  const qs = q.toString();
  const raw = await apiRequest<unknown>(
    `/order/totalamountrange${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      fallbackError: "Statistikani yuklab bo'lmadi",
    },
  );

  return normalizeTotalAmountRange(raw);
}
