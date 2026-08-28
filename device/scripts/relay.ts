/**
 * Postman ishlaydigan kompyuterda ishga tushiring:
 *   cd device && npm run relay
 *
 * Mac .env ga qo'shing:
 *   HIKVISION_GATEWAY=http://SHU_KOMPYUTER_IP:5199
 */
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { createHikvisionProxyMiddleware } from "../server/proxyMiddleware";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv("development", root, "");
const port = Number(process.env.RELAY_PORT || 5199);
const middleware = createHikvisionProxyMiddleware(env);

const server = http.createServer((req, res) => {
  middleware(req, res, () => {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Hikvision relay — /api/access-events, /ISAPI, /api/picture");
  });
});

server.listen(port, "0.0.0.0", () => {
  const host = env.HIKVISION_HOST || "192.168.1.40";
  console.log(`[relay] Hikvision relay ishga tushdi`);
  console.log(`[relay] Ulanish: http://0.0.0.0:${port}`);
  console.log(`[relay] Kamera:   http://${host}`);
  console.log(`[relay] Mac .env: HIKVISION_GATEWAY=http://<shu-kompyuter-ip>:${port}`);
});
