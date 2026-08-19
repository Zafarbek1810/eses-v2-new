/**
 * Backend API base URL.
 *
 * Dev va production: VITE_API_BASE_URL=http://64.188.59.127:3000
 * Dev: Vite proxy (CORS yo'q). Production build: brauzer to'g'ridan-to'g'ri shu URL ga so'rov yuboradi.
 */
const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export const API_BASE_URL = import.meta.env.DEV ? "" : (fromEnv ?? "");

/** Backend server manzili (proxy / ma'lumot uchun). */
export const BACKEND_URL = fromEnv || "http://127.0.0.1:3000";
