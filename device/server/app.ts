/**
 * Hikvision Express backend (ishlayotgan server.js asosida).
 *   cd device && npm run server
 */
import express from "express";
import cors from "cors";
import DigestFetch from "digest-fetch";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = loadEnv("development", root, "");

const DEVICE_IP = (env.HIKVISION_HOST || "192.168.1.40").replace(/^https?:\/\//, "").replace(/\/$/, "");
const DEVICE_USER = env.HIKVISION_USER || "admin";
const DEVICE_PASSWORD = env.HIKVISION_PASSWORD || "A112233a";
const PORT = Number(env.HIKVISION_SERVER_PORT || 3001);

const client = new DigestFetch(DEVICE_USER, DEVICE_PASSWORD, { basic: false });
const deviceBaseUrl = `http://${DEVICE_IP}`;

function formatNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Noma'lum xato";

  if (message.includes("EHOSTUNREACH") || message.includes("ENETUNREACH")) {
    return [
      `Kamera tarmog'iga ulanib bo'lmadi (${DEVICE_IP}).`,
      "Backend kameraga yetadigan kompyuterda ishlashi kerak (Postman/server.js ishlaydigan joyda).",
      "Mac da faqat frontend: device/.env ga VITE_HIKVISION_API_URL=http://SHU_KOMPYUTER_IP:3001",
    ].join(" ");
  }
  if (message.includes("ECONNREFUSED")) {
    return `Kamera javob bermayapti (${DEVICE_IP}). IP yoki kamera holatini tekshiring.`;
  }
  if (message.includes("ETIMEDOUT") || message.toLowerCase().includes("timeout")) {
    return `Kamera bilan bog'lanish vaqti tugadi (${DEVICE_IP}).`;
  }

  return message;
}

const app = express();
app.use(cors());
app.use(express.json());

type AccessEventsBody = {
  startTime?: string;
  endTime?: string;
  maxResults?: number;
  searchResultPosition?: number;
  major?: number;
  minor?: number;
  AcsEventCond?: {
    startTime?: string;
    endTime?: string;
    maxResults?: number;
    searchResultPosition?: number;
    major?: number;
    minor?: number;
  };
};

function parseAccessEventsBody(body: AccessEventsBody) {
  const cond = body.AcsEventCond ?? body;
  return {
    startTime: cond.startTime,
    endTime: cond.endTime,
    maxResults: cond.maxResults ?? 30,
    searchResultPosition: cond.searchResultPosition ?? 0,
    major: cond.major ?? 5,
    minor: cond.minor ?? 75,
  };
}

app.get("/api/camera/status", async (_req, res) => {
  try {
    const response = await client.fetch(`${deviceBaseUrl}/`, { method: "GET" });
    res.json({
      ok: response.status < 500,
      target: deviceBaseUrl,
      message: response.status < 500 ? "Kamera javob berdi" : `HTTP ${response.status}`,
    });
  } catch (error) {
    const message = formatNetworkError(error);
    res.json({ ok: false, target: deviceBaseUrl, error: message, message });
  }
});

app.post("/api/access-events", async (req, res) => {
  try {
    const { startTime, endTime, maxResults, searchResultPosition, major, minor } =
      parseAccessEventsBody(req.body as AccessEventsBody);

    if (!startTime || !endTime) {
      res.status(400).json({ error: "startTime va endTime majburiy" });
      return;
    }

    const deviceResponse = await client.fetch(
      `${deviceBaseUrl}/ISAPI/AccessControl/AcsEvent?format=json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          AcsEventCond: {
            searchID: "1",
            searchResultPosition,
            maxResults,
            major,
            minor,
            startTime,
            endTime,
            picEnable: true,
          },
        }),
      },
    );

    const text = await deviceResponse.text();

    if (deviceResponse.status >= 400) {
      res.status(deviceResponse.status).json({
        error: `Kamera javobi: ${deviceResponse.status}`,
        raw: text.slice(0, 500),
      });
      return;
    }

    try {
      res.json(JSON.parse(text));
    } catch {
      res.status(502).json({ error: "Qurilmadan noto'g'ri javob", raw: text.slice(0, 500) });
    }
  } catch (error) {
    console.error("[access-events]", error);
    const message = formatNetworkError(error);
    res.status(502).json({ error: message, target: deviceBaseUrl });
  }
});

app.get("/api/picture", async (req, res) => {
  try {
    const picturePath = req.query.path;
    if (typeof picturePath !== "string" || !picturePath) {
      res.status(400).json({ error: "path parametri kerak" });
      return;
    }

    const normalized = picturePath.startsWith("/") ? picturePath : `/${picturePath}`;
    const response = await client.fetch(`${deviceBaseUrl}${normalized}`, { method: "GET" });

    if (response.status >= 400) {
      res.status(response.status).json({ error: "Rasm yuklanmadi" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.set("Content-Type", response.headers.get("content-type") || "image/jpeg");
    res.set("Cache-Control", "private, max-age=300");
    res.send(buffer);
  } catch (error) {
    const message = formatNetworkError(error);
    res.status(502).json({ error: message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[hikvision] Express backend: http://0.0.0.0:${PORT}`);
  console.log(`[hikvision] Kamera: ${deviceBaseUrl} (user: ${DEVICE_USER})`);
  console.log(`[hikvision] API: POST http://localhost:${PORT}/api/access-events`);
  console.log(`[hikvision] Boshqa kompyuterlar uchun: http://<shu-ip>:${PORT}/api/access-events`);
});
