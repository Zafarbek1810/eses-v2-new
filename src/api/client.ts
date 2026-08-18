import { getAccessToken } from "./session";
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

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
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
    const fallback =
      res.status === 401 && path.includes("/login")
        ? "Email yoki parol noto'g'ri"
        : fallbackError;
    throw new ApiError(messageFromBody(parsed, fallback), res.status, parsed);
  }

  return parsed as T;
}
