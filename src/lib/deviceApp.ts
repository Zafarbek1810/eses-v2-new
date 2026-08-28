const DEFAULT_HR_APP_URL = "http://127.0.0.1:5175";

export const HR_APP_URL =
  (import.meta.env.VITE_HR_APP_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_HR_APP_URL;

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

/** Brauzer popup bloklamasligi uchun <a> orqali ochish (production uchun eng ishonchli). */
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

/** Dev: Vite middleware orqali Hikvision backend + frontendni ishga tushiradi. */
async function ensureHrAppRunningDev(): Promise<string> {
  const response = await fetch("/api/device/start", { method: "POST" });
  const payload = (await response.json().catch(() => ({}))) as HrStartResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Hikvision HR server ishga tushmadi");
  }

  return payload.url || HR_APP_URL;
}

/** Production: faqat foydalanuvchi kompyuteridagi localhost HR manzilini qaytaradi. */
export function getHrAppUrl(): string {
  return HR_APP_URL;
}

/** @deprecated ensureHrAppRunningDev yoki getHrAppUrl dan foydalaning */
export async function ensureHrAppRunning(): Promise<string> {
  if (!IS_DEV) return getHrAppUrl();
  return ensureHrAppRunningDev();
}

/** @deprecated ensureHrAppRunning ga o'ting */
export const ensureDeviceAppRunning = ensureHrAppRunning;

/**
 * HR tabini darhol ochadi — faqat click handler ichida chaqiring (sync).
 * Production: localhost anchor orqali (popup bloklanmaydi).
 * Dev: about:blank tab + keyin bootstrapDevHrTab.
 */
export function openDeviceHrAppSync(): Window | null {
  if (!IS_DEV) {
    openViaAnchor(HR_APP_URL);
    return null;
  }
  return openBlankTab();
}

/** Dev rejimida ochilgan tabni Hikvision URL ga yo'naltiradi. */
export async function bootstrapDevHrTab(tab: Window | null): Promise<void> {
  if (!IS_DEV) return;

  if (!tab) {
    throw new Error(
      "Popup bloklandi. Brauzer sozlamalaridan popup ga ruxsat bering yoki qo'lda oching: "
      + HR_APP_URL,
    );
  }

  writeLoadingPage(tab);

  try {
    const url = await ensureHrAppRunningDev();
    if (!tab.closed) {
      tab.location.replace(url);
    }
  } catch (error) {
    if (!tab.closed) tab.close();
    throw error;
  }
}

/** @deprecated openDeviceHrAppSync + bootstrapDevHrTab dan foydalaning */
export async function openDeviceHrApp(): Promise<Window | null> {
  const tab = openDeviceHrAppSync();
  await bootstrapDevHrTab(tab);
  return tab;
}

export function showHrBlockedHelp(): void {
  window.alert(
    `HR ochilmadi.\n\n1) Brauzer popup blokini o'chiring\n2) Yoki qo'lda oching: ${HR_APP_URL}\n\nKompyuteringizda ishga tushiring:\n  cd NodeJS_Hikvision && npm start\n  cd Hikvision && npm run dev`,
  );
}
