import { spawn, type ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
import type { ServerResponse } from "http";
import type { Connect } from "vite";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type HrLauncherOptions = {
  frontendPort: number;
  backendPort: number;
  frontendDir?: string;
  backendDir?: string;
  startupTimeoutMs?: number;
};

let backendProcess: ChildProcess | null = null;
let frontendProcess: ChildProcess | null = null;
let startingPromise: Promise<void> | null = null;

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function checkPortOnHost(port: number, host: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.createConnection({ port, host });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(800);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function checkPort(port: number): Promise<boolean> {
  return (await checkPortOnHost(port, "127.0.0.1")) || (await checkPortOnHost(port, "::1"));
}

async function isBackendUp(port: number): Promise<boolean> {
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

async function isFrontendUp(port: number): Promise<boolean> {
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

async function isHrStackUp(frontendPort: number, backendPort: number): Promise<boolean> {
  return (await isBackendUp(backendPort)) && (await isFrontendUp(frontendPort));
}

function logOutput(prefix: string, chunk: Buffer) {
  for (const line of chunk.toString().split("\n").filter(Boolean)) {
    console.log(`[${prefix}] ${line}`);
  }
}

function watchChildFailure(child: ChildProcess, label: string): Promise<never> {
  return new Promise((_, reject) => {
    child.once("exit", code => {
      if (code != null && code !== 0) {
        reject(new Error(`${label} ishga tushmadi (code: ${code})`));
      }
    });
    child.once("error", error => {
      reject(error);
    });
  });
}

async function waitUntilBackendReady(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isBackendUp(port)) return;
    await sleep(400);
  }
  throw new Error(`Hikvision backend ${port} portda ishga tushmadi`);
}

async function waitUntilFrontendReady(port: number, timeoutMs: number): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isFrontendUp(port)) return;
    await sleep(400);
  }
  throw new Error(`Hikvision frontend ${port} portda ishga tushmadi`);
}

async function startBackendProcess(
  backendDir: string,
  backendPort: number,
  startupTimeoutMs: number,
): Promise<void> {
  if (await isBackendUp(backendPort)) return;

  if (backendProcess && backendProcess.exitCode == null) {
    await Promise.race([
      waitUntilBackendReady(backendPort, startupTimeoutMs),
      watchChildFailure(backendProcess, "hikvision-backend"),
    ]);
    return;
  }

  backendProcess = spawn("node", ["server.js"], {
    cwd: backendDir,
    stdio: "pipe",
    env: {
      ...process.env,
      PORT: String(backendPort),
    },
    shell: true,
  });

  backendProcess.stdout?.on("data", chunk => logOutput("hikvision-backend", chunk));
  backendProcess.stderr?.on("data", chunk => logOutput("hikvision-backend", chunk));
  backendProcess.on("exit", code => {
    console.log(`[hikvision-backend] jarayon tugadi (code: ${code ?? "?"})`);
    backendProcess = null;
  });

  await Promise.race([
    waitUntilBackendReady(backendPort, startupTimeoutMs),
    watchChildFailure(backendProcess, "hikvision-backend"),
  ]);
}

async function startFrontendProcess(
  frontendDir: string,
  frontendPort: number,
  startupTimeoutMs: number,
): Promise<void> {
  const frontendEnv = loadEnv("development", frontendDir, "");

  if (await isFrontendUp(frontendPort)) return;

  if (frontendProcess && frontendProcess.exitCode == null) {
    await Promise.race([
      waitUntilFrontendReady(frontendPort, startupTimeoutMs),
      watchChildFailure(frontendProcess, "hikvision-frontend"),
    ]);
    return;
  }

  frontendProcess = spawn(
    "npx",
    ["vite", "--port", String(frontendPort), "--strictPort"],
    {
      cwd: frontendDir,
      stdio: "pipe",
      env: {
        ...process.env,
        ...frontendEnv,
        HIKVISION_FRONTEND_PORT: String(frontendPort),
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
    waitUntilFrontendReady(frontendPort, startupTimeoutMs),
    watchChildFailure(frontendProcess, "hikvision-frontend"),
  ]);
}

async function startHrStack(options: HrLauncherOptions): Promise<void> {
  const {
    frontendPort,
    backendPort,
    frontendDir = path.join(ROOT_DIR, "Hikvision"),
    backendDir = path.join(ROOT_DIR, "NodeJS_Hikvision"),
    startupTimeoutMs = 60_000,
  } = options;

  if (await isHrStackUp(frontendPort, backendPort)) return;

  await startBackendProcess(backendDir, backendPort, startupTimeoutMs);
  await startFrontendProcess(frontendDir, frontendPort, startupTimeoutMs);
}

export async function ensureHrAppRunning(options: HrLauncherOptions): Promise<void> {
  if (await isHrStackUp(options.frontendPort, options.backendPort)) return;

  if (!startingPromise) {
    startingPromise = startHrStack(options).finally(() => {
      startingPromise = null;
    });
  }

  await startingPromise;
}

export function createHrLauncherMiddleware(options: HrLauncherOptions): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/api/device/start") return next();
    if (req.method !== "POST" && req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Faqat GET yoki POST" });
      return;
    }

    try {
      const alreadyRunning = await isHrStackUp(options.frontendPort, options.backendPort);
      if (!alreadyRunning) {
        await ensureHrAppRunning(options);
      }

      sendJson(res, 200, {
        ok: true,
        running: true,
        url: `http://localhost:${options.frontendPort}`,
        backendUrl: `http://localhost:${options.backendPort}`,
        started: !alreadyRunning,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "HR server ishga tushmadi";
      sendJson(res, 500, { ok: false, error: message });
    }
  };
}

/** @deprecated HrLauncherOptions ga o'ting */
export type DeviceLauncherOptions = HrLauncherOptions;

/** @deprecated ensureHrAppRunning ga o'ting */
export const ensureDeviceServerRunning = ensureHrAppRunning;

/** @deprecated createHrLauncherMiddleware ga o'ting */
export const createDeviceLauncherMiddleware = createHrLauncherMiddleware;
