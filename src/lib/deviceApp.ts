const DEFAULT_DEVICE_APP_URL = "http://localhost:5180";

export const DEVICE_APP_URL =
  (import.meta.env.VITE_DEVICE_APP_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_DEVICE_APP_URL;

type DeviceStartResponse = {
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
          <p style="font-size:14px;color:#64748b;margin:0;">Device server ishga tushirilmoqda</p>
        </div>
      </div>
    `;
  } catch {
    /* cross-origin safety */
  }
}

/** Dev rejimida device server ishlamasa, avtomatik ishga tushiradi. */
export async function ensureDeviceAppRunning(): Promise<string> {
  const response = await fetch("/api/device/start", { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as DeviceStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Device server ishga tushmadi");
  }

  return payload.url || DEVICE_APP_URL;
}

/** Device serverni ishga tushirib, HR sahifasini yangi tabda ochadi. */
export async function openDeviceHrApp(): Promise<Window | null> {
  // Popup bloklanmasligi uchun tab darhol ochiladi (await dan oldin).
  const tab = window.open("about:blank", "_blank");
  if (tab) {
    tab.opener = null;
    writeLoadingPage(tab);
  }

  try {
    const url = await ensureDeviceAppRunning();

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
