const DEFAULT_HR_APP_URL = "http://localhost:5175";
const DEFAULT_HR_LAUNCHER_URL = "http://localhost:5198";

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

function writeLoadingPage(tab: Window) {
  try {
    tab.document.title = "SES HR";
    tab.document.body.innerHTML = `
      <div style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f4f7fb;color:#0f172a;">
        <div style="text-align:center;max-width:420px;padding:24px;">
          <p style="font-size:18px;font-weight:600;margin:0 0 8px;">HR yuklanmoqda...</p>
          <p style="font-size:14px;color:#64748b;margin:0;">Hikvision frontend va backend ishga tushirilmoqda</p>
        </div>
      </div>
    `;
  } catch {
    /* cross-origin safety */
  }
}

function openViaAnchor(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function openBlankTab(): Window | null {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  return tab;
}

async function ensureHrAppRunningDev(): Promise<string> {
  const response = await fetch("/api/device/start", { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as HrStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Hikvision HR server ishga tushmadi");
  }

  return payload.url || HR_APP_URL;
}

async function ensureHrAppRunningLocal(): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${HR_LAUNCHER_URL}/start`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error(
      "Lokal HR launcher ishlamayapti.\n\n"
      + "Kompyuteringizda bir marta ishga tushiring:\n"
      + "  npm run hr:launcher\n\n"
      + "Keyin eses.uz da HR ni qayta bosing.",
    );
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
  return ensureHrAppRunningLocal();
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

  writeLoadingPage(tab);

  try {
    const url = IS_DEV ? await ensureHrAppRunningDev() : await ensureHrAppRunningLocal();
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
  window.alert(
    `HR ochilmadi.\n\nLokal launcher ishga tushiring:\n  npm run hr:launcher\n\nKeyin qo'lda oching: ${HR_APP_URL}`,
  );
}
