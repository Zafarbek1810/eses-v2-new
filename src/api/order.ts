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
};

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
  /** SMS dagi natija PDF havolasi (public /showresult/...) */
  result_link_sms: string;
}>;

function normalizeFullResponse(
  raw: unknown,
  params: OrdersFullParams,
): OrdersFullResponse {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  if (Array.isArray(raw)) {
    return { data: raw as Order[], total: raw.length, page, limit };
  }

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const data = (obj.data ?? obj.orders ?? obj.items ?? obj.result) as
      | Order[]
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

export function getAllOrders() {
  return apiRequest<Order[]>("/order/getall", {
    method: "GET",
    fallbackError: "Buyurtmalarni yuklab bo'lmadi",
  });
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

export function getOrderById(id: number, options?: { auth?: boolean }) {
  return apiRequest<Order>(`/order/getby/${id}`, {
    method: "GET",
    auth: options?.auth ?? true,
    fallbackError: "Buyurtmani yuklab bo'lmadi",
  });
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
