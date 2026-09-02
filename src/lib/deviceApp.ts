const DEFAULT_HR_APP_URL = "http://localhost:5173";

export const HR_APP_URL =
  (import.meta.env.VITE_HR_APP_URL as string | undefined)?.replace(/\/$/, "")
  || DEFAULT_HR_APP_URL;

/** @deprecated HR_APP_URL dan foydalaning */
export const DEVICE_APP_URL = HR_APP_URL;

export function getHrAppUrl(): string {
  return HR_APP_URL;
}

/** HR ni alohida dastur sifatida yangi tabda ochadi (localhost). */
export function openHrApp(): Window | null {
  const tab = window.open(HR_APP_URL, "_blank", "noopener,noreferrer");
  if (tab) tab.opener = null;
  return tab;
}

/** @deprecated openHrApp dan foydalaning */
export function openDeviceHrAppSync(): Window | null {
  return openHrApp();
}

/** @deprecated openHrApp dan foydalaning */
export async function openDeviceHrApp(): Promise<Window | null> {
  return openHrApp();
}
