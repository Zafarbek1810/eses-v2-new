import http from "node:http";
import { URL } from "node:url";
import type { DigestResponse } from "./digestRequest";

/** Gateway relay ga oddiy HTTP (digest relaysiz). */
export function plainHttpRequest(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<DigestResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url);
    const headers = { ...options.headers };
    if (options.body) {
      headers["Content-Length"] = Buffer.byteLength(options.body).toString();
    }

    const req = http.request(
      {
        host: parsed.hostname,
        port: parsed.port || 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers,
        family: 4,
        timeout: options.timeoutMs ?? 20_000,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on("data", chunk => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Gateway javob bermadi (${parsed.hostname})`));
    });
    req.on("error", error => reject(error));

    if (options.body) req.write(options.body);
    req.end();
  });
}
