type DeviceApiError = {
  error?: string;
};

export type DeviceApiResult<T> = {
  data: T;
  mock: false | "force" | "fallback";
};

/** Device app ichidagi barcha API so'rovlari shu orqali ketadi. */
export async function deviceApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<DeviceApiResult<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
  });

  const mockHeader = response.headers.get("x-hikvision-mock");
  const mock = mockHeader === "force" || mockHeader === "fallback" ? mockHeader : false;

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = raw || `API xato: ${response.status}`;
    try {
      const payload = JSON.parse(raw) as DeviceApiError;
      if (payload.error) message = payload.error;
    } catch {
      /* plain text xato */
    }
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return {
      data: await response.json() as T,
      mock,
    };
  }

  return {
    data: await response.text() as T,
    mock,
  };
}

/** Kelajakdagi Hikvision API lar uchun — /ISAPI path orqali server proxy. */
export async function hikvisionApi<T>(
  isapiPath: string,
  init: RequestInit = {},
): Promise<T> {
  const normalized = isapiPath.startsWith("/") ? isapiPath : `/${isapiPath}`;
  return deviceApi<T>(normalized, init).then(result => result.data);
}
