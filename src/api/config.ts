/**
 * Backend API base URL.
 *
 * `.env`: VITE_API_BASE_URL=https://eses.uz/api
 * Dev: Vite proxy (CORS yo'q). Production: brauzer to'g'ridan-to'g'ri shu manzilga so'rov yuboradi.
 */
const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const backendUrl = fromEnv || "https://eses.uz/api";

export const API_BASE_URL = import.meta.env.DEV ? "" : backendUrl;

/** Backend server manzili (proxy / ma'lumot uchun). */
export const BACKEND_URL = backendUrl;
