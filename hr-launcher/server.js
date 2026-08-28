import express from "express";
import cors from "cors";
import net from "net";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = process.env.HR_PROJECT_ROOT || path.resolve(__dirname, "..");

const LAUNCHER_PORT = Number(process.env.HR_LAUNCHER_PORT || 5198);
const FRONTEND_PORT = Number(process.env.HIKVISION_FRONTEND_PORT || 5175);
const BACKEND_PORT = Number(process.env.HIKVISION_BACKEND_PORT || 3001);
const FRONTEND_DIR = process.env.HIKVISION_FRONTEND_DIR || path.join(ROOT_DIR, "Hikvision");
const BACKEND_DIR = process.env.HIKVISION_BACKEND_DIR || path.join(ROOT_DIR, "NodeJS_Hikvision");
const STARTUP_TIMEOUT_MS = Number(process.env.HR_STARTUP_TIMEOUT_MS || 60_000);

const ALLOWED_ORIGINS = [
  "https://eses.uz",
  "https://www.eses.uz",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

let backendProcess = null;
let frontendProcess = null;
let startingPromise = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkPortOnHost(port, host) {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    const finish = ok => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function checkPort(port) {
  return (await checkPortOnHost(port, "127.0.0.1")) || (await checkPortOnHost(port, "::1"));
}

async function isBackendUp(port) {
  if (!(await checkPort(port))) return false;
  try {
    const response = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.ok;
  } catch {
    return true;
  }
}

async function isFrontendUp(port) {
  if (!(await checkPort(port))) return false;
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.status < 500;
  } catch {
    return true;
  }
}

async function isHrStackUp() {
  return (await isBackendUp(BACKEND_PORT)) && (await isFrontendUp(FRONTEND_PORT));
}

function logOutput(prefix, chunk) {
  for (const line of chunk.toString().split("\n").filter(Boolean)) {
    console.log(`[${prefix}] ${line}`);
  }
}

function watchChildFailure(child, label) {
  return new Promise((_, reject) => {
    child.once("exit", code => {
      if (code != null && code !== 0) {
        reject(new Error(`${label} ishga tushmadi (code: ${code})`));
      }
    });
    child.once("error", reject);
  });
}

async function waitUntilBackendReady(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isBackendUp(BACKEND_PORT)) return;
    await sleep(400);
  }
  throw new Error(`Backend localhost:${BACKEND_PORT} da ishga tushmadi`);
}

async function waitUntilFrontendReady(timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isFrontendUp(FRONTEND_PORT)) return;
    await sleep(400);
  }
  throw new Error(`Frontend localhost:${FRONTEND_PORT} da ishga tushmadi`);
}

async function startBackendProcess() {
  if (await isBackendUp(BACKEND_PORT)) return;

  if (backendProcess && backendProcess.exitCode == null) {
    await Promise.race([
      waitUntilBackendReady(STARTUP_TIMEOUT_MS),
      watchChildFailure(backendProcess, "hikvision-backend"),
    ]);
    return;
  }

  backendProcess = spawn("node", ["server.js"], {
    cwd: BACKEND_DIR,
    stdio: "pipe",
    env: { ...process.env, PORT: String(BACKEND_PORT) },
    shell: true,
  });

  backendProcess.stdout?.on("data", chunk => logOutput("hikvision-backend", chunk));
  backendProcess.stderr?.on("data", chunk => logOutput("hikvision-backend", chunk));
  backendProcess.on("exit", code => {
    console.log(`[hikvision-backend] jarayon tugadi (code: ${code ?? "?"})`);
    backendProcess = null;
  });

  await Promise.race([
    waitUntilBackendReady(STARTUP_TIMEOUT_MS),
    watchChildFailure(backendProcess, "hikvision-backend"),
  ]);
}

async function startFrontendProcess() {
  if (await isFrontendUp(FRONTEND_PORT)) return;

  if (frontendProcess && frontendProcess.exitCode == null) {
    await Promise.race([
      waitUntilFrontendReady(STARTUP_TIMEOUT_MS),
      watchChildFailure(frontendProcess, "hikvision-frontend"),
    ]);
    return;
  }

  frontendProcess = spawn(
    "npx",
    ["vite", "--port", String(FRONTEND_PORT), "--strictPort"],
    {
      cwd: FRONTEND_DIR,
      stdio: "pipe",
      env: {
        ...process.env,
        HIKVISION_FRONTEND_PORT: String(FRONTEND_PORT),
      },
      shell: true,
    },
  );

  frontendProcess.stdout?.on("data", chunk => logOutput("hikvision-frontend", chunk));
  frontendProcess.stderr?.on("data", chunk => logOutput("hikvision-frontend", chunk));
  frontendProcess.on("exit", code => {
    console.log(`[hikvision-frontend] jarayon tugadi (code: ${code ?? "?"})`);
    frontendProcess = null;
  });

  await Promise.race([
    waitUntilFrontendReady(STARTUP_TIMEOUT_MS),
    watchChildFailure(frontendProcess, "hikvision-frontend"),
  ]);
}

async function ensureHrStackRunning() {
  if (await isHrStackUp()) return;

  if (!startingPromise) {
    startingPromise = (async () => {
      await startBackendProcess();
      await startFrontendProcess();
    })().finally(() => {
      startingPromise = null;
    });
  }

  await startingPromise;
}

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  methods: ["GET", "POST", "OPTIONS"],
}));

app.get("/health", (_req, res) => {
  res.json({ ok: true, launcher: true });
});

app.all("/start", async (_req, res) => {
  try {
    const alreadyRunning = await isHrStackUp();
    if (!alreadyRunning) {
      await ensureHrStackRunning();
    }

    res.json({
      ok: true,
      running: true,
      url: `http://localhost:${FRONTEND_PORT}`,
      backendUrl: `http://localhost:${BACKEND_PORT}`,
      started: !alreadyRunning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "HR server ishga tushmadi";
    res.status(500).json({ ok: false, error: message });
  }
});

app.listen(LAUNCHER_PORT, "127.0.0.1", () => {
  console.log(`[hr-launcher] http://localhost:${LAUNCHER_PORT}`);
  console.log(`[hr-launcher] Frontend: localhost:${FRONTEND_PORT}, Backend: localhost:${BACKEND_PORT}`);
  console.log("[hr-launcher] eses.uz dan HR bosilganda avtomatik ishga tushadi");
});
