import {
  getAccessToken,
  getRefreshToken,
  updateSessionTokens,
  forceSessionExpired,
} from "./session";
import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function messageFromBody(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const b = body as Record<string, unknown>;
  if (typeof b.message === "string") return b.message;
  if (Array.isArray(b.message) && b.message.every(m => typeof m === "string")) {
    return b.message.join(", ");
  }
  if (typeof b.error === "string") return b.error;
  return fallback;
}

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
  fallbackError?: string;
};

type RefreshResponse = {
  accessToken?: string;
  refreshToken?: string;
};

/** Shared in-flight refresh so parallel 401s only hit /user/refresh once. */
let refreshPromise: Promise<string | null> | null = null;

function isAuthRefreshPath(path: string): boolean {
  return path.includes("/user/refresh") || path.includes("/user/login");
}

async function requestNewAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_BASE_URL}/user/refresh`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    if (!res.ok) return null;

    const data = parsed as RefreshResponse;
    if (!data?.accessToken || !data?.refreshToken) return null;

    updateSessionTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function refreshAccessTokenShared(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = requestNewAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  retried = false,
): Promise<T> {
  const {
    body,
    auth = true,
    fallbackError = "So'rov muvaffaqiyatsiz",
    headers: extraHeaders,
    ...rest
  } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(extraHeaders as Record<string, string> | undefined),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let parsed: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const canTryRefresh =
      res.status === 401 &&
      auth &&
      !retried &&
      !isAuthRefreshPath(path);

    if (canTryRefresh) {
      const newToken = await refreshAccessTokenShared();
      if (newToken) {
        return apiRequest<T>(path, options, true);
      }
      forceSessionExpired();
      throw new ApiError(
        "Sessiya muddati tugadi. Qayta kiring",
        401,
        parsed,
      );
    }

    const fallback =
      res.status === 401 && path.includes("/login")
        ? "Email yoki parol noto'g'ri"
        : fallbackError;
    throw new ApiError(messageFromBody(parsed, fallback), res.status, parsed);
  }

  return parsed as T;
}
