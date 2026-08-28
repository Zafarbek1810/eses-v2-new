import { spawn, type ChildProcess } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "vite";
import type { ServerResponse } from "http";
import type { Connect } from "vite";

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type DeviceLauncherOptions = {
  port: number;
  deviceDir?: string;
  startupTimeoutMs?: number;
};

let deviceProcess: ChildProcess | null = null;
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

async function isDeviceServerUp(port: number): Promise<boolean> {
  if (!(await checkPort(port))) return false;
  try {
    const response = await fetch(`http://localhost:${port}/`, {
      signal: AbortSignal.timeout(1500),
    });
    return response.status < 500;
  } catch {
    // Port ochiq, lekin HTTP hali tayyor emas.
    return true;
  }
}

function logDeviceOutput(chunk: Buffer) {
  for (const line of chunk.toString().split("\n").filter(Boolean)) {
    console.log(`[device] ${line}`);
  }
}

function watchChildFailure(child: ChildProcess): Promise<never> {
  return new Promise((_, reject) => {
    child.once("exit", code => {
      if (code != null && code !== 0) {
        reject(new Error(`Device server ishga tushmadi (code: ${code})`));
      }
    });
    child.once("error", error => {
      reject(error);
    });
  });
}

async function waitUntilDeviceReady(port: number, timeoutMs: number, child: ChildProcess): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (await isDeviceServerUp(port)) return;
    await sleep(400);
  }

  throw new Error(`Device server ${port} portda ishga tushmadi`);
}

async function startDeviceProcess(options: DeviceLauncherOptions): Promise<void> {
  const { port, deviceDir = path.join(ROOT_DIR, "device"), startupTimeoutMs = 60_000 } = options;
  const deviceEnv = loadEnv("development", deviceDir, "");

  if (await isDeviceServerUp(port)) return;

  if (deviceProcess && deviceProcess.exitCode == null) {
    await Promise.race([
      waitUntilDeviceReady(port, startupTimeoutMs, deviceProcess),
      watchChildFailure(deviceProcess),
    ]);
    return;
  }

  deviceProcess = spawn(
    "npx",
    ["vite", "--port", String(port), "--strictPort"],
    {
      cwd: deviceDir,
      stdio: "pipe",
      env: {
        ...process.env,
        ...deviceEnv,
        DEVICE_PORT: String(port),
      },
      shell: true,
    },
  );

  deviceProcess.stdout?.on("data", logDeviceOutput);
  deviceProcess.stderr?.on("data", logDeviceOutput);
  deviceProcess.on("exit", code => {
    console.log(`[device] jarayon tugadi (code: ${code ?? "?"})`);
    deviceProcess = null;
  });

  await Promise.race([
    waitUntilDeviceReady(port, startupTimeoutMs, deviceProcess),
    watchChildFailure(deviceProcess),
  ]);
}

export async function ensureDeviceServerRunning(options: DeviceLauncherOptions): Promise<void> {
  if (await isDeviceServerUp(options.port)) return;

  if (!startingPromise) {
    startingPromise = startDeviceProcess(options).finally(() => {
      startingPromise = null;
    });
  }

  await startingPromise;
}

export function createDeviceLauncherMiddleware(options: DeviceLauncherOptions): Connect.NextHandleFunction {
  return async (req, res, next) => {
    const pathname = req.url?.split("?")[0];
    if (pathname !== "/api/device/start") return next();
    if (req.method !== "POST" && req.method !== "GET") {
      sendJson(res, 405, { ok: false, error: "Faqat GET yoki POST" });
      return;
    }

    try {
      const alreadyRunning = await isDeviceServerUp(options.port);
      if (!alreadyRunning) {
        await ensureDeviceServerRunning(options);
      }

      sendJson(res, 200, {
        ok: true,
        running: true,
        url: `http://localhost:${options.port}`,
        started: !alreadyRunning,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Device server ishga tushmadi";
      sendJson(res, 500, { ok: false, error: message });
    }
  };
}
