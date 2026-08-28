const DEFAULT_HR_APP_URL = "http://localhost:5175";

export const HR_APP_URL =
  (import.meta.env.VITE_HR_APP_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_HR_APP_URL;

/** @deprecated HR_APP_URL dan foydalaning */
export const DEVICE_APP_URL = HR_APP_URL;

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
        <div style="text-align:center;">
          <p style="font-size:18px;font-weight:600;margin:0 0 8px;">HR yuklanmoqda...</p>
          <p style="font-size:14px;color:#64748b;margin:0;">Hikvision server ishga tushirilmoqda</p>
        </div>
      </div>
    `;
  } catch {
    /* cross-origin safety */
  }
}

/** Dev rejimida Hikvision backend + frontend ishlamasa, avtomatik ishga tushiradi. */
export async function ensureHrAppRunning(): Promise<string> {
  const response = await fetch("/api/device/start", { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as HrStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Hikvision HR server ishga tushmadi");
  }

  return payload.url || HR_APP_URL;
}

/** @deprecated ensureHrAppRunning ga o'ting */
export const ensureDeviceAppRunning = ensureHrAppRunning;

/** Hikvision backend + frontendni ishga tushirib, HR sahifasini yangi tabda ochadi. */
export async function openDeviceHrApp(): Promise<Window | null> {
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    tab.opener = null;
    writeLoadingPage(tab);
  }

  try {
    const url = await ensureHrAppRunning();

    if (tab && !tab.closed) {
      tab.location.replace(url);
      return tab;
    }

    const fallback = window.open(url, "_blank");
    if (!fallback) window.location.assign(url);
    return fallback ?? tab;
  } catch (error) {
    if (tab && !tab.closed) tab.close();
    throw error;
  }
}
