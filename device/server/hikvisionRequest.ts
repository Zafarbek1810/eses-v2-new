import DigestClient from "digest-fetch";
import type { HikvisionConfig } from "./hikvisionClient";
import { hikvisionUrl } from "./hikvisionClient";
import type { DigestResponse } from "./digestRequest";
import { digestFetch } from "./digestRequest";
import { plainHttpRequest } from "./plainRequest";

async function requestWithDigestFetch(
  config: HikvisionConfig,
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<DigestResponse> {
  const client = new DigestClient(config.username, config.password, { basic: false });
  const response = await client.fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.headers,
    body: init?.body,
  });

  const headers: Record<string, string> = {};
  response.headers.forEach((value: string, key: string) => {
    headers[key] = value;
  });

  const body = Buffer.from(await response.arrayBuffer());
  return {
    statusCode: response.status,
    headers,
    body,
  };
}

export async function hikvisionRequest(
  config: HikvisionConfig,
  path: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<DigestResponse> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = hikvisionUrl(config, normalized);
  const method = init?.method ?? "GET";

  // Gateway relay o'zi kameraga digest auth qiladi.
  if (config.gateway) {
    return plainHttpRequest({
      url,
      method,
      headers: init?.headers,
      body: init?.body,
    });
  }

  try {
    return await digestFetch(url, {
      method,
      headers: init?.headers,
      body: init?.body,
      username: config.username,
      password: config.password,
      localAddress: config.localAddress,
    });
  } catch (nativeError) {
    try {
      return await requestWithDigestFetch(config, url, init);
    } catch {
      throw nativeError instanceof Error ? nativeError : new Error("Kamera bilan bog'lanib bo'lmadi");
    }
  }
}
