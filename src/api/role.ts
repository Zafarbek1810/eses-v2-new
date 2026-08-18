import { apiRequest } from "./client";

export type Role = {
  id: number;
  name: string;
  description: string;
  createdAt: string;
  user: unknown[];
  company_id?: number | null;
  companyId?: number | null;
  company?: { id: number; name?: string } | null;
};

export type RolePayload = {
  name: string;
  description: string;
};

export type RoleWithCompanyPayload = {
  name: string;
  description: string;
  company_id: number;
  region_id?: number;
};

export function extractRoleId(raw: unknown): number | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const candidate =
    obj.id ??
    (obj.data && typeof obj.data === "object" ? (obj.data as Record<string, unknown>).id : undefined) ??
    (obj.role && typeof obj.role === "object" ? (obj.role as Record<string, unknown>).id : undefined);
  return typeof candidate === "number" ? candidate : null;
}

export function getAllRoles(companyId?: number) {
  const query = companyId != null ? `?company_id=${companyId}` : "";
  return apiRequest<Role[]>(`/role/getall${query}`, {
    method: "GET",
    fallbackError: "Rollarni yuklab bo'lmadi",
  });
}

export function getRoleById(id: number) {
  return apiRequest<Role>(`/role/getby/${id}`, {
    method: "GET",
    fallbackError: "Rolni yuklab bo'lmadi",
  });
}

export function addRole(payload: RolePayload) {
  return apiRequest<Role>("/role/add", {
    method: "POST",
    body: payload,
    fallbackError: "Rol qo'shib bo'lmadi",
  });
}

export function addRoleWithCompany(payload: RoleWithCompanyPayload) {
  return apiRequest<Role>("/role/addrolewithcompany", {
    method: "POST",
    body: payload,
    fallbackError: "Kompaniya roli qo'shib bo'lmadi",
  });
}

export function updateRole(id: number, payload: RolePayload) {
  return apiRequest<Role>(`/role/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Rolni yangilab bo'lmadi",
  });
}

export function deleteRole(id: number) {
  return apiRequest<unknown>(`/role/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Rolni o'chirib bo'lmadi",
  });
}
