import { apiRequest } from "./client";
import { unwrapCompany } from "./company";

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

type RoleCompanySource = {
  user?: Array<{ role?: Partial<Role> | null }>;
  role?: unknown;
  roles?: unknown;
};

const REMEMBERED_STORAGE_KEY = "ses_scoped_company_roles";
const extraRolesByCompany = new Map<number, Map<number, Role>>();

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function asPositiveId(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function roleCompanyId(role: Pick<Role, "company" | "company_id" | "companyId">): number | null {
  const company = role.company as unknown;
  const companyObj = asRecord(company);
  return asPositiveId(
    role.company_id
    ?? role.companyId
    ?? companyObj?.id
    ?? (typeof company === "number" || typeof company === "string" ? company : null),
  );
}

export function extractRoleId(raw: unknown): number | null {
  if (typeof raw === "number" || typeof raw === "string") return asPositiveId(raw);
  const obj = asRecord(raw);
  if (!obj) return null;
  return (
    asPositiveId(obj.id) ??
    extractRoleId(obj.data) ??
    extractRoleId(obj.role) ??
    extractRoleId(obj.result)
  );
}

export function normalizeRoleRecord(raw: unknown): Role | null {
  const obj = asRecord(raw);
  if (!obj) return null;
  const nested = asRecord(obj.role) ?? asRecord(obj.data) ?? obj;
  const id = asPositiveId(nested.id ?? obj.id);
  if (id == null) return null;
  const company = asRecord(nested.company ?? obj.company);
  const companyId = asPositiveId(
    nested.company_id ?? nested.companyId ?? obj.company_id ?? obj.companyId ?? company?.id,
  );
  const users = nested.user ?? nested.users ?? obj.user ?? obj.users;
  return {
    id,
    name: String(nested.name ?? obj.name ?? ""),
    description: String(nested.description ?? obj.description ?? ""),
    createdAt: String(nested.createdAt ?? nested.created_at ?? obj.createdAt ?? obj.created_at ?? ""),
    user: Array.isArray(users) ? users : [],
    company_id: companyId,
    companyId,
    company: company && asPositiveId(company.id)
      ? { id: asPositiveId(company.id) as number, name: String(company.name ?? "") }
      : null,
  };
}

function pushUniqueRoles(target: unknown[], value: unknown) {
  if (Array.isArray(value)) {
    target.push(...value);
    return;
  }
  if (value && typeof value === "object") target.push(value);
}

export function normalizeRoleList(raw: unknown): Role[] {
  const list: unknown[] = [];
  if (Array.isArray(raw)) {
    pushUniqueRoles(list, raw);
  } else {
    const obj = asRecord(raw);
    const data = obj?.data ?? obj?.roles ?? obj?.role ?? obj?.items ?? obj?.result;
    if (Array.isArray(data)) {
      pushUniqueRoles(list, data);
    } else {
      const nested = asRecord(data);
      pushUniqueRoles(list, nested?.roles ?? nested?.role ?? nested?.items ?? nested?.data ?? data);
      if (list.length === 0) pushUniqueRoles(list, raw);
    }
  }

  const byId = new Map<number, Role>();
  for (const item of list) {
    const role = normalizeRoleRecord(item);
    if (role) byId.set(role.id, role);
  }
  return [...byId.values()];
}

function stampCompany(role: Role, companyId: number): Role {
  const existing = roleCompanyId(role);
  if (existing != null) return role;
  return {
    ...role,
    company_id: companyId,
    companyId,
    company: role.company ?? { id: companyId },
  };
}

function hydrateRememberedRoles() {
  if (extraRolesByCompany.size > 0 || typeof sessionStorage === "undefined") return;
  try {
    const raw = sessionStorage.getItem(REMEMBERED_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      const companyId = asPositiveId(key);
      if (companyId == null || !Array.isArray(value)) continue;
      const map = new Map<number, Role>();
      for (const item of value) {
        const role = normalizeRoleRecord(item);
        if (role) map.set(role.id, stampCompany(role, companyId));
      }
      extraRolesByCompany.set(companyId, map);
    }
  } catch {
    extraRolesByCompany.clear();
  }
}

function persistRememberedRoles() {
  if (typeof sessionStorage === "undefined") return;
  const payload: Record<string, Role[]> = {};
  for (const [companyId, roles] of extraRolesByCompany) {
    payload[String(companyId)] = [...roles.values()];
  }
  sessionStorage.setItem(REMEMBERED_STORAGE_KEY, JSON.stringify(payload));
}

export function rememberCompanyRole(companyId: number, role: Role | null | undefined) {
  if (!role?.id || !Number.isFinite(companyId) || companyId <= 0) return;
  hydrateRememberedRoles();
  let map = extraRolesByCompany.get(companyId);
  if (!map) {
    map = new Map();
    extraRolesByCompany.set(companyId, map);
  }
  map.set(role.id, stampCompany(role, companyId));
  persistRememberedRoles();
}

export function forgetCompanyRole(companyId: number, roleId: number) {
  hydrateRememberedRoles();
  extraRolesByCompany.get(companyId)?.delete(roleId);
  persistRememberedRoles();
}

export function rememberedCompanyRoles(companyId: number): Role[] {
  hydrateRememberedRoles();
  return [...(extraRolesByCompany.get(companyId)?.values() ?? [])];
}

function addRawRoles(add: (role: Role | null | undefined) => void, value: unknown) {
  if (Array.isArray(value)) {
    for (const item of value) add(normalizeRoleRecord(item));
    return;
  }
  add(normalizeRoleRecord(value));
}

export function collectScopedRoles(
  fetched: Role[],
  company: RoleCompanySource | null,
  companyId: number,
  extra: Role[] = [],
): Role[] {
  const byId = new Map<number, Role>();

  const add = (role: Role | null | undefined) => {
    if (!role) return;
    const cid = roleCompanyId(role);
    if (cid != null && cid !== companyId) return;
    byId.set(role.id, stampCompany(role, companyId));
  };

  for (const role of Array.isArray(fetched) ? fetched : []) add(role);
  for (const role of extra) add(role);
  for (const role of rememberedCompanyRoles(companyId)) add(role);

  const source = company ? unwrapCompany(company) as RoleCompanySource & Record<string, unknown> : null;
  if (source) {
    addRawRoles(add, source.role);
    addRawRoles(add, source.roles);
    addRawRoles(add, (source as Record<string, unknown>).Role);
    addRawRoles(add, (source as Record<string, unknown>).Roles);
    const users = Array.isArray(source.user)
      ? source.user
      : Array.isArray((source as Record<string, unknown>).users)
        ? (source as Record<string, unknown>).users as RoleCompanySource["user"]
        : [];
    for (const user of users ?? []) {
      if (!user?.role) continue;
      add(normalizeRoleRecord(user.role));
    }
  }

  return [...byId.values()];
}

function mergeRoleLists(companyId: number, lists: Role[][], keepUnscoped = false): Role[] {
  const byId = new Map<number, Role>();
  for (const list of lists) {
    for (const role of list) {
      if (!role?.id) continue;
      const cid = roleCompanyId(role);
      if (cid != null && cid !== companyId) continue;
      if (cid == null && !keepUnscoped) continue;
      const prev = byId.get(role.id);
      byId.set(role.id, stampCompany(prev ? { ...prev, ...role } : role, companyId));
    }
  }
  return [...byId.values()];
}

async function mapInBatches<T, R>(items: T[], batchSize: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    out.push(...await Promise.all(chunk.map(fn)));
  }
  return out;
}

async function hydrateRoleCompanies(roles: Role[]): Promise<Role[]> {
  const pending = roles.filter(role => role.id > 0 && roleCompanyId(role) == null).slice(0, 150);
  if (pending.length === 0) return roles;

  const details = await mapInBatches(pending, 6, async role => {
    try {
      const raw = await apiRequest<unknown>(`/role/getby/${role.id}`, {
        method: "GET",
        fallbackError: "Rolni yuklab bo'lmadi",
      });
      return normalizeRoleRecord(raw) ?? role;
    } catch {
      return role;
    }
  });

  const byId = new Map(roles.map(role => [role.id, role]));
  for (const role of details) {
    if (!role?.id) continue;
    const prev = byId.get(role.id);
    byId.set(role.id, prev ? { ...prev, ...role } : role);
  }
  return [...byId.values()];
}

export async function getAllRoles(companyId?: number) {
  if (companyId != null && companyId > 0) {
    const [scoped, all] = await Promise.all([
      apiRequest<unknown>(`/role/getall?company_id=${companyId}`, {
        method: "GET",
        fallbackError: "Rollarni yuklab bo'lmadi",
      })
        .then(normalizeRoleList)
        .catch(() => [] as Role[]),
      apiRequest<unknown>("/role/getall", {
        method: "GET",
        fallbackError: "Rollarni yuklab bo'lmadi",
      })
        .then(normalizeRoleList)
        .catch(() => [] as Role[]),
    ]);

    const hydratedAll = await hydrateRoleCompanies(all);
    const matching = hydratedAll.filter(role => roleCompanyId(role) === companyId);

    // /role/getall?company_id= JWT o'rniga query ni olsin-olmasin, javobdagi
    // company_id bo'sh rollarni tashlab yubormaslik kerak — director getall
    // ham company_id siz qaytaradi, lekin JWT scoped.
    return mergeRoleLists(
      companyId,
      [scoped, matching, rememberedCompanyRoles(companyId)],
      true,
    );
  }

  const raw = await apiRequest<unknown>("/role/getall", {
    method: "GET",
    fallbackError: "Rollarni yuklab bo'lmadi",
  });
  return normalizeRoleList(raw);
}

export function getRoleById(id: number) {
  return apiRequest<unknown>(`/role/getby/${id}`, {
    method: "GET",
    fallbackError: "Rolni yuklab bo'lmadi",
  }).then(raw => normalizeRoleRecord(raw) ?? (raw as Role));
}

export async function addRole(payload: RolePayload) {
  const raw = await apiRequest<unknown>("/role/add", {
    method: "POST",
    body: payload,
    fallbackError: "Rol qo'shib bo'lmadi",
  });
  return normalizeRoleRecord(raw) ?? (raw as Role);
}

export async function addRoleWithCompany(payload: RoleWithCompanyPayload) {
  const raw = await apiRequest<unknown>("/role/addrolewithcompany", {
    method: "POST",
    body: payload,
    fallbackError: "Kompaniya roli qo'shib bo'lmadi",
  });
  const role = normalizeRoleRecord(raw);
  const created = role ? stampCompany(role, payload.company_id) : (raw as Role);
  rememberCompanyRole(payload.company_id, created);
  return created;
}

export function updateRole(id: number, payload: RolePayload) {
  return apiRequest<unknown>(`/role/update/${id}`, {
    method: "PATCH",
    body: payload,
    fallbackError: "Rolni yangilab bo'lmadi",
  }).then(raw => normalizeRoleRecord(raw) ?? (raw as Role));
}

export function deleteRole(id: number, companyId?: number) {
  if (companyId != null) forgetCompanyRole(companyId, id);
  return apiRequest<unknown>(`/role/delete/${id}`, {
    method: "DELETE",
    fallbackError: "Rolni o'chirib bo'lmadi",
  });
}
