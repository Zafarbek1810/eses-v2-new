import { endOfDay, format, startOfDay } from "date-fns";
import type { IncomingMessage, ServerResponse } from "http";
import type { AcsEventCond } from "../src/types/acsEvent";
import type { HikvisionConfig } from "./hikvisionClient";
import { hikvisionRequest } from "./hikvisionRequest";
import { buildMockAcsEventResponse } from "./mockAcsEvent";

const ACS_EVENT_PATH = "/ISAPI/AccessControl/AcsEvent?format=json";
const DEFAULT_PAGE_SIZE = 30;

export function buildDefaultAcsEventCond(
  date = new Date(),
  maxResults = DEFAULT_PAGE_SIZE,
  searchResultPosition = 0,
  timezone = "+05:00",
): AcsEventCond {
  const start = startOfDay(date);
  const end = endOfDay(date);

  return {
    searchID: "1",
    searchResultPosition,
    maxResults,
    major: 5,
    minor: 75,
    startTime: `${format(start, "yyyy-MM-dd")}T00:00:00${timezone}`,
    endTime: `${format(end, "yyyy-MM-dd")}T23:59:59${timezone}`,
    picEnable: true,
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown, extraHeaders?: Record<string, string>) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    res.setHeader(key, value);
  }
  res.end(JSON.stringify(payload));
}

function parseCondFromQuery(url: URL, timezone: string): AcsEventCond {
  const cond = buildDefaultAcsEventCond(new Date(), DEFAULT_PAGE_SIZE, 0, timezone);
  const startTime = url.searchParams.get("startTime");
  const endTime = url.searchParams.get("endTime");
  const maxResults = url.searchParams.get("maxResults");
  const searchResultPosition = url.searchParams.get("searchResultPosition");

  if (startTime) cond.startTime = startTime;
  if (endTime) cond.endTime = endTime;
  if (maxResults) cond.maxResults = Number(maxResults) || cond.maxResults;
  if (searchResultPosition) cond.searchResultPosition = Number(searchResultPosition) || 0;

  return cond;
}

function parseCondFromBody(raw: string, url: URL, timezone: string): AcsEventCond {
  if (!raw.trim()) return parseCondFromQuery(url, timezone);

  const parsed = JSON.parse(raw) as { AcsEventCond?: Partial<AcsEventCond> };
  const defaults = parseCondFromQuery(url, timezone);
  return {
    ...defaults,
    ...parsed.AcsEventCond,
  };
}

export async function handleAccessEvents(
  req: IncomingMessage,
  res: ServerResponse,
  config: HikvisionConfig,
  options?: {
    onMock?: (reason: "force" | "fallback") => void;
    onError?: (message: string) => void;
  },
) {
  const url = new URL(req.url ?? "/", "http://localhost");
  const method = req.method ?? "GET";

  if (method !== "GET" && method !== "POST") {
    sendJson(res, 405, { error: "Faqat GET yoki POST" });
    return;
  }

  if (config.mockMode === "force") {
    options?.onMock?.("force");
    sendJson(res, 200, buildMockAcsEventResponse(), { "X-Hikvision-Mock": "force" });
    return;
  }

  let cond: AcsEventCond;
  try {
    if (method === "POST") {
      const raw = await readBody(req);
      cond = parseCondFromBody(raw, url, config.timezone);
    } else {
      cond = parseCondFromQuery(url, config.timezone);
    }
  } catch {
    sendJson(res, 400, { error: "So'rov tanasi noto'g'ri JSON" });
    return;
  }

  const body = JSON.stringify({ AcsEventCond: cond });

  try {
    const upstream = await hikvisionRequest(config, ACS_EVENT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (upstream.statusCode >= 400) {
      const snippet = upstream.body.toString("utf8").slice(0, 300);
      sendJson(res, upstream.statusCode, {
        error: `Kamera javobi: ${upstream.statusCode}`,
        details: snippet,
      });
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(upstream.body);
  } catch (error) {
    if (config.mockMode === "fallback") {
      const message = error instanceof Error ? error.message : "Kamera ulanmadi";
      options?.onMock?.("fallback");
      options?.onError?.(message);
      sendJson(res, 200, buildMockAcsEventResponse(), { "X-Hikvision-Mock": "fallback" });
      return;
    }

    const message = error instanceof Error ? error.message : "Kamera bilan bog'lanib bo'lmadi";
    sendJson(res, 502, { error: message });
  }
}
