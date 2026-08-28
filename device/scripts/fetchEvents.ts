/**
 * Postman dagi so'rov bilan bir xil — haqiqiy kameradan ma'lumot olish.
 *   cd device && npx tsx scripts/fetchEvents.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { createHikvisionConfig } from "../server/hikvisionClient";
import { hikvisionRequest } from "../server/hikvisionRequest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv("development", root, "");
const config = createHikvisionConfig({ ...env, HIKVISION_MOCK: "off" });

const body = JSON.stringify({
  AcsEventCond: {
    searchID: "1",
    searchResultPosition: 0,
    maxResults: 30,
    major: 5,
    minor: 75,
    startTime: process.env.START_TIME || "2026-08-01T00:00:00+05:00",
    endTime: process.env.END_TIME || "2026-08-27T23:59:59+05:00",
    picEnable: true,
  },
});

async function main() {
  console.log(`Kamera: http://${config.host} (user: ${config.username})`);

  const res = await hikvisionRequest(config, "/ISAPI/AccessControl/AcsEvent?format=json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  console.log(`HTTP ${res.statusCode}`);
  console.log(res.body.toString("utf8"));
}

main().catch(error => {
  console.error("XATO:", error instanceof Error ? error.message : error);
  process.exit(1);
});
