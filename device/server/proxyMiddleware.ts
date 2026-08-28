import type { IncomingMessage, ServerResponse } from "http";
import type { Connect } from "vite";
import { handleAccessEvents } from "./accessEvents";
import { testCameraTcp } from "./digestRequest";
import { createHikvisionConfig, hikvisionBaseUrl } from "./hikvisionClient";
import { hikvisionRequest } from "./hikvisionRequest";
import { buildMockAcsEventResponse } from "./mockAcsEvent";

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function formatHikvisionError(error: unknown, host: string): string {
  const message = error instanceof Error ? error.message : "Noma'lum xato";
  if (message.includes(host) || message.includes("Digest") || message.includes("Kamera")) {
    return message;
  }

  if (message.includes("EHOSTUNREACH") || message.includes("ENETUNREACH")) {
    return `Kamera tarmog'iga ulanib bo'lmadi (${host}). Kompyuter va kamera bir xil Wi-Fi/LAN tarmog'ida bo'lishi kerak.`;
  }
  if (message.includes("ECONNREFUSED")) {
    return `Kamera javob bermayapti (${host}). IP manzil noto'g'ri yoki kamera o'chiq bo'lishi mumkin.`;
  }
  if (message.includes("ETIMEDOUT") || message.toLowerCase().includes("timeout")) {
    return `Kamera bilan bog'lanish vaqti tugadi (${host}).`;
  }
  if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
    return `Digest auth xato: login yoki parol noto'g'ri (${host}).`;
  }

  return message;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sendBuffer(
  res: ServerResponse,
  status: number,
  body: Buffer,
  contentType: string,
  extraHeaders?: Record<string, string>,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", contentType);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    res.setHeader(key, value);
  }
  res.end(body);
}

type ProxyContext = {
  config: ReturnType<typeof createHikvisionConfig>;
};

function sendMockAcsEvent(res: ServerResponse, reason: "force" | "fallback") {
  sendBuffer(
    res,
    200,
    Buffer.from(JSON.stringify(buildMockAcsEventResponse())),
    "application/json",
    { "X-Hikvision-Mock": reason },
  );
}

async function handleIsapiProxy(req: IncomingMessage, res: ServerResponse, ctx: ProxyContext) {
  const parsed = new URL(req.url ?? "/", "http://localhost");
  const targetPath = `${parsed.pathname}${parsed.search}`;
  const method = req.method ?? "GET";
  const isAcsEvent = method === "POST" && targetPath.startsWith("/ISAPI/AccessControl/AcsEvent");

  if (ctx.config.mockMode === "force" && isAcsEvent) {
    sendMockAcsEvent(res, "force");
    return;
  }

  const init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
  } = { method };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await readBody(req);
    init.headers = { "Content-Type": "application/json" };
  }

  try {
    const upstream = await hikvisionRequest(ctx.config, targetPath, init);

    if (upstream.statusCode >= 400) {
      console.error(`[hikvision] ${method} ${targetPath} -> ${upstream.statusCode}`);
    }

    sendBuffer(
      res,
      upstream.statusCode,
      upstream.body,
      String(upstream.headers["content-type"] || "application/json"),
    );
  } catch (error) {
    if (ctx.config.mockMode === "fallback" && isAcsEvent) {
      const message = formatHikvisionError(error, ctx.config.host);
      console.warn("[hikvision] kamera ulanmadi, demo ma'lumot:", message);
      sendMockAcsEvent(res, "fallback");
      return;
    }
    throw error;
  }
}

async function handlePicture(req: IncomingMessage, res: ServerResponse, ctx: ProxyContext) {
  const url = new URL(req.url ?? "", "http://localhost");
  const picturePath = url.searchParams.get("path");
  if (!picturePath) {
    sendJson(res, 400, { error: "path parametri kerak" });
    return;
  }

  const upstream = await hikvisionRequest(ctx.config, picturePath, { method: "GET" });
  if (upstream.statusCode >= 400) {
    sendJson(res, upstream.statusCode, { error: "Rasm yuklanmadi" });
    return;
  }

  sendBuffer(
    res,
    200,
    upstream.body,
    String(upstream.headers["content-type"] || "image/jpeg"),
    { "Cache-Control": "private, max-age=300" },
  );
}

async function handleCameraStatus(res: ServerResponse, ctx: ProxyContext) {
  const target = hikvisionBaseUrl(ctx.config);

  if (ctx.config.mockMode === "force") {
    sendJson(res, 200, {
      ok: true,
      mock: true,
      target,
      message: "Demo rejimi (HIKVISION_MOCK=force)",
    });
    return;
  }

  try {
    await testCameraTcp(ctx.config.host, ctx.config.port, 3000, ctx.config.localAddress);
    sendJson(res, 200, {
      ok: true,
      target,
      message: "Kamera porti ochiq",
    });
  } catch (error) {
    const message = formatHikvisionError(error, ctx.config.host);
    sendJson(res, 200, {
      ok: false,
      mock: ctx.config.mockMode === "fallback",
      target,
      error: message,
      message: ctx.config.mockMode === "fallback"
        ? "Kamera ulanmagan — demo ma'lumot ko'rsatiladi"
        : message,
    });
  }
}

export function createHikvisionProxyMiddleware(env: Record<string, string>): Connect.NextHandleFunction {
  const config = createHikvisionConfig(env);
  const ctx: ProxyContext = { config };

  const mockLabel = config.mockMode === "force"
    ? ", mock: force"
    : config.mockMode === "fallback"
      ? ", mock: fallback"
      : "";
  const gatewayLabel = config.gateway ? `, gateway: ${config.gateway}` : "";

  console.log(
    `[hikvision] proxy -> ${hikvisionBaseUrl(config)} (user: ${config.username}${config.localAddress ? `, bind: ${config.localAddress}` : ""}${gatewayLabel}${mockLabel})`,
  );

  return async (req, res, next) => {
    const pathname = req.url?.split("?")[0] ?? "";

    try {
      if (pathname === "/api/camera/status" && req.method === "GET") {
        await handleCameraStatus(res, ctx);
        return;
      }

      if (pathname === "/api/access-events" && (req.method === "GET" || req.method === "POST")) {
        await handleAccessEvents(req, res, ctx.config, {
          onMock: reason => console.warn(`[hikvision] demo ma'lumot (${reason})`),
          onError: message => console.warn("[hikvision] kamera ulanmadi:", message),
        });
        return;
      }

      if (pathname.startsWith("/ISAPI")) {
        await handleIsapiProxy(req, res, ctx);
        return;
      }

      if (req.url?.startsWith("/api/picture") && req.method === "GET") {
        await handlePicture(req, res, ctx);
        return;
      }
    } catch (error) {
      const message = formatHikvisionError(error, config.host);
      console.error("[hikvision] proxy xato:", message);
      sendJson(res, 502, { error: message, target: hikvisionBaseUrl(config) });
      return;
    }

    return next();
  };
}
