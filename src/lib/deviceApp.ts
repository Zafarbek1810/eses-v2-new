const DEFAULT_HR_APP_URL = "http://localhost:5175";
const DEFAULT_HR_LAUNCHER_URL = "http://localhost:5198";
const HR_PROTOCOL = "ses-hr://start";
const LAUNCHER_WAIT_MS = 60_000;

export const HR_APP_URL =
  (import.meta.env.VITE_HR_APP_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_HR_APP_URL;

export const HR_LAUNCHER_URL =
  (import.meta.env.VITE_HR_LAUNCHER_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_HR_LAUNCHER_URL;

/** @deprecated HR_APP_URL dan foydalaning */
export const DEVICE_APP_URL = HR_APP_URL;

const IS_DEV = import.meta.env.DEV;

type HrStartResponse = {
  ok?: boolean;
  error?: string;
  url?: string;
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isMacOs(): boolean {
  const platform = navigator.userAgentData?.platform ?? navigator.platform ?? "";
  if (/mac/i.test(platform)) return true;
  return /Mac/i.test(navigator.userAgent);
}

function writeLoadingPage(tab: Window, message: string) {
  try {
    tab.document.title = "SES HR";
    tab.document.body.innerHTML = `
      <div style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f7fb;color:#0f172a;">
        <div style="text-align:center;max-width:420px;padding:24px;">
          <p style="font-size:18px;font-weight:600;margin:0 0 8px;">HR yuklanmoqda...</p>
          <p style="font-size:14px;color:#64748b;margin:0;">${message}</p>
        </div>
      </div>
    `;
  } catch {
    /* cross-origin safety */
  }
}

function openBlankTab(): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

async function isLauncherUp(): Promise<boolean> {
  try {
    const response = await fetch(`${HR_LAUNCHER_URL}/health`, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function triggerLocalLauncherStart(): void {
  const link = document.createElement("a");
  link.href = HR_PROTOCOL;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function installHelpMessage(): string {
  if (isMacOs()) {
    return [
      "HR launcher topilmadi.",
      "",
      "Terminalda loyiha papkasida bir marta ishga tushiring:",
      "  chmod +x hr-launcher/install-mac.command",
      "  ./hr-launcher/install-mac.command",
      "",
      "Chrome \"local network\" ruxsatini so'rasa — Allow bosing.",
      "Keyin eses.uz da HR ni qayta bosing.",
    ].join("\n");
  }
  return [
    "HR launcher topilmadi.",
    "",
    "Bir marta ishga tushiring:",
    "  hr-launcher\\install-windows.bat",
    "",
    "Keyin eses.uz da HR ni qayta bosing.",
  ].join("\n");
}

async function waitForLauncher(tab: Window | null): Promise<void> {
  const started = Date.now();
  let lastTrigger = 0;

  while (Date.now() - started < LAUNCHER_WAIT_MS) {
    if (await isLauncherUp()) return;

    const elapsed = Date.now() - started;
    if (elapsed - lastTrigger > 4000) {
      triggerLocalLauncherStart();
      lastTrigger = elapsed;
    }

    if (tab && !tab.closed) {
      const sec = Math.ceil((LAUNCHER_WAIT_MS - elapsed) / 1000);
      writeLoadingPage(
        tab,
        `HR launcher ishga tushirilmoqda… (${sec}s)\nChrome ruxsat so'rasa — Allow bosing.`,
      );
    }
    await sleep(1000);
  }

  throw new Error(installHelpMessage());
}

async function ensureLocalLauncherRunning(tab: Window | null): Promise<void> {
  if (await isLauncherUp()) return;

  if (tab && !tab.closed) {
    writeLoadingPage(tab, "HR launcher ishga tushirilmoqda…");
  }

  triggerLocalLauncherStart();
  await waitForLauncher(tab);
}

async function ensureHrAppRunningDev(): Promise<string> {
  const response = await fetch("/api/device/start", { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as HrStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Hikvision HR server ishga tushmadi");
  }

  return payload.url || HR_APP_URL;
}

async function ensureHrAppRunningLocal(tab: Window | null): Promise<string> {
  await ensureLocalLauncherRunning(tab);

  if (tab && !tab.closed) {
    writeLoadingPage(tab, "Hikvision frontend va backend ishga tushirilmoqda…");
  }

  let response: Response;
  try {
    response = await fetch(`${HR_LAUNCHER_URL}/start`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error(installHelpMessage());
  }

  const payload = (await response.json().catch(() => ({}))) as HrStartResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Hikvision HR server ishga tushmadi");
  }

  return payload.url || HR_APP_URL;
}

export function getHrAppUrl(): string {
  return HR_APP_URL;
}

/** @deprecated ensureHrAppRunningDev yoki ensureHrAppRunningLocal dan foydalaning */
export async function ensureHrAppRunning(): Promise<string> {
  if (IS_DEV) return ensureHrAppRunningDev();
  return ensureHrAppRunningLocal(null);
}

/** @deprecated ensureHrAppRunning ga o'ting */
export const ensureDeviceAppRunning = ensureHrAppRunning;

/** HR tabini darhol ochadi — faqat click handler ichida chaqiring (sync). */
export function openDeviceHrAppSync(): Window | null {
  return openBlankTab();
}

/** Dev yoki production: serverni ishga tushirib, tabni localhost HR ga yo'naltiradi. */
export async function bootstrapHrTab(tab: Window | null): Promise<void> {
  if (!tab) {
    throw new Error(
      "Popup bloklandi. Brauzer sozlamalaridan popup ga ruxsat bering yoki qo'lda oching: "
      + HR_APP_URL,
    );
  }

  writeLoadingPage(tab, "Hikvision frontend va backend ishga tushirilmoqda…");

  try {
    const url = IS_DEV
      ? await ensureHrAppRunningDev()
      : await ensureHrAppRunningLocal(tab);

    if (!tab.closed) {
      tab.location.replace(url);
    }
  } catch (error) {
    if (!tab.closed) tab.close();
    throw error;
  }
}

/** @deprecated bootstrapHrTab dan foydalaning */
export async function bootstrapDevHrTab(tab: Window | null): Promise<void> {
  return bootstrapHrTab(tab);
}

/** @deprecated openDeviceHrAppSync + bootstrapHrTab dan foydalaning */
export async function openDeviceHrApp(): Promise<Window | null> {
  const tab = openDeviceHrAppSync();
  await bootstrapHrTab(tab);
  return tab;
}

export function showHrBlockedHelp(): void {
  window.alert(installHelpMessage());
}
