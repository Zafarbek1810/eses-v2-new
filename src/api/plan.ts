import { apiRequest } from "./client";

export type BillingCycle = "monthly" | "yearly";

export type Plan = {
  id: number;
  name: string;
  description: string;
  price: string;
  billingCycle: BillingCycle;
  createdAt?: string;
  updatedAt?: string;
};

export type PlanPayload = {
  name: string;
  description: string;
  price: string;
  billingCycle: BillingCycle;
};

function normalizePlans(raw: unknown): Plan[] {
  if (Array.isArray(raw)) return raw as Plan[];
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const data = obj.data ?? obj.plans ?? obj.items ?? obj.result;
  return Array.isArray(data) ? data as Plan[] : [];
}

export async function getAllPlans(): Promise<Plan[]> {
  const raw = await apiRequest<unknown>("/plan/getall", {
    method: "GET",
    fallbackError: "Tariflarni yuklab bo'lmadi",
  });
  return normalizePlans(raw);
}

export function getPlanById(id: number) {
  return apiRequest<Plan>(`/plan/getby/${id}`, {
    method: "GET",
    fallbackError: "Tarifni yuklab bo'lmadi",
  });
}

export function addPlan(payload: PlanPayload) {
  return apiRequest<Plan>("/plan/add", {
    method: "POST",
    body: payload,
    fallbackError: "Tarifni qo'shib bo'lmadi",
  });
}

export function updatePlan(id: number, payload: PlanPayload) {
  return apiRequest<Plan>(`/plan/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Tarifni yangilab bo'lmadi",
  });
}

export function deletePlan(id: number) {
  return apiRequest<unknown>(`/plan/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Tarifni o'chirib bo'lmadi",
  });
}
