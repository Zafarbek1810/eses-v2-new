export type AuthCompany = {
  id: number;
  name: string;
  description: string;
  address: string;
  createdAt: string;
  region?: { id: number; name: string } | null;
};

export type AuthRole = {
  id: number;
  name: string;
  description?: string;
  createdAt?: string;
  region?: { id: number; name: string } | null;
} | null;

export type AuthUser = {
  id: number;
  username: string;
  surname: string;
  email: string;
  createdAt: string;
  role?: AuthRole;
  company?: AuthCompany | null;
};

export type LoginResponse = {
  user: AuthUser & { password?: string };
  accessToken: string;
  exspiresIn_accessToken: string;
  refreshToken: string;
  exspiresIn_refreshToken: string;
};

const STORAGE_KEYS = {
  accessToken: "ses_access_token",
  refreshToken: "ses_refresh_token",
  user: "ses_user",
  companyId: "ses_company_id",
} as const;

function storage(persist: boolean): Storage {
  return persist ? localStorage : sessionStorage;
}

export function saveSession(data: LoginResponse, persist = true) {
  const store = storage(persist);
  const other = persist ? sessionStorage : localStorage;

  other.removeItem(STORAGE_KEYS.accessToken);
  other.removeItem(STORAGE_KEYS.refreshToken);
  other.removeItem(STORAGE_KEYS.user);
  other.removeItem(STORAGE_KEYS.companyId);

  const { password: _pw, ...safeUser } = data.user;
  store.setItem(STORAGE_KEYS.accessToken, data.accessToken);
  store.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
  store.setItem(STORAGE_KEYS.user, JSON.stringify(safeUser));

  const companyId = data.user.company?.id;
  if (companyId != null) {
    store.setItem(STORAGE_KEYS.companyId, String(companyId));
  } else {
    store.removeItem(STORAGE_KEYS.companyId);
  }
}

export function clearSession() {
  for (const store of [localStorage, sessionStorage]) {
    store.removeItem(STORAGE_KEYS.accessToken);
    store.removeItem(STORAGE_KEYS.refreshToken);
    store.removeItem(STORAGE_KEYS.user);
    store.removeItem(STORAGE_KEYS.companyId);
  }
}

export function getAccessToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.accessToken) ??
    sessionStorage.getItem(STORAGE_KEYS.accessToken)
  );
}

export function getRefreshToken(): string | null {
  return (
    localStorage.getItem(STORAGE_KEYS.refreshToken) ??
    sessionStorage.getItem(STORAGE_KEYS.refreshToken)
  );
}

export function getStoredCompanyId(): number | null {
  const raw =
    localStorage.getItem(STORAGE_KEYS.companyId) ??
    sessionStorage.getItem(STORAGE_KEYS.companyId);

  if (raw != null && raw !== "") {
    const id = Number(raw);
    if (Number.isFinite(id)) return id;
  }

  const user = getStoredUser();
  const fromUser = user?.company?.id;
  return typeof fromUser === "number" && Number.isFinite(fromUser) ? fromUser : null;
}

export function getStoredUser(): AuthUser | null {
  const raw =
    localStorage.getItem(STORAGE_KEYS.user) ??
    sessionStorage.getItem(STORAGE_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

/** Update cached user in whichever storage currently holds the session. */
export function setStoredUser(user: AuthUser) {
  const { password: _pw, ...safeUser } = user as AuthUser & { password?: string };
  const payload = JSON.stringify(safeUser);

  if (localStorage.getItem(STORAGE_KEYS.accessToken)) {
    localStorage.setItem(STORAGE_KEYS.user, payload);
    const companyId = safeUser.company?.id;
    if (companyId != null) {
      localStorage.setItem(STORAGE_KEYS.companyId, String(companyId));
    }
    return;
  }

  if (sessionStorage.getItem(STORAGE_KEYS.accessToken)) {
    sessionStorage.setItem(STORAGE_KEYS.user, payload);
    const companyId = safeUser.company?.id;
    if (companyId != null) {
      sessionStorage.setItem(STORAGE_KEYS.companyId, String(companyId));
    }
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAccessToken());
}
