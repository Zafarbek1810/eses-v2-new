/** App role keys used for menu / page access. */
export type AppRole =
  | "super_admin"
  | "admin"
  | "director"
  | "kassir"
  | "lab_director"
  | "lab_asistant";

/** Nav item ids from App sidebar. */
export type NavId =
  | "dashboard"
  | "management"
  | "companies"
  | "region-admins"
  | "plans"
  | "subscriptions"
  | "history"
  | "global-data"
  | "global-laboratories"
  | "global-analyses"
  | "global-templates"
  | "patients"
  | "kassa"
  | "orders"
  | "results"
  | "employees"
  | "hr"
  | "ai-demo";

const NAV_GROUP_CHILDREN: Partial<Record<NavId, readonly NavId[]>> = {
  "global-data": ["global-laboratories", "global-analyses", "global-templates"],
};

const ROLE_NAV: Record<AppRole, readonly NavId[]> = {
  super_admin: ["dashboard", "region-admins", "plans", "subscriptions", "history", "global-data", "ai-demo"],
  admin: ["dashboard", "companies", "plans", "ai-demo"],
  director: [
    "dashboard",
    "management",
    "hr",
    "ai-demo",
    // "patients",
    // "kassa",
    // "orders",
    // "results",
  ],
  kassir: ["patients", "kassa", "results", "ai-demo"],
  lab_director: ["dashboard", "orders", "results", "ai-demo"],
  lab_asistant: ["dashboard", "results", "ai-demo"],
};

/** Accept common spellings / casing from the API. */
const ROLE_ALIASES: Record<string, AppRole> = {
  super_admin: "super_admin",
  superadmin: "super_admin",
  admin: "admin",
  director: "director",
  kassir: "kassir",
  cashier: "kassir",
  lab_director: "lab_director",
  labdirector: "lab_director",
  lab_asistant: "lab_asistant",
  lab_assistant: "lab_asistant",
  labasistant: "lab_asistant",
  labassistant: "lab_asistant",
};

export function normalizeRoleName(name: string | null | undefined): AppRole | null {
  if (!name) return null;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] ?? null;
}

export function getAllowedNavIds(roleName: string | null | undefined): readonly NavId[] {
  const role = normalizeRoleName(roleName);
  if (!role) return [];
  return ROLE_NAV[role];
}

export function canAccessNav(roleName: string | null | undefined, navId: string): boolean {
  const allowed = getAllowedNavIds(roleName);
  if (allowed.includes(navId as NavId)) return true;
  return allowed.some(parent => NAV_GROUP_CHILDREN[parent]?.includes(navId as NavId));
}

export function getDefaultNavId(roleName: string | null | undefined): NavId {
  const allowed = getAllowedNavIds(roleName);
  return allowed[0] ?? "dashboard";
}
