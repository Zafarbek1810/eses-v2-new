/**
 * Backend API base URL.
 *
 * Manzilni o'zgartirish uchun faqat `.env` dagi `VITE_API_BASE_URL` ni yangilang.
 * Dev rejimida so'rovlar Vite proxy orqali ketadi (CORS muammosiz).
 * Production buildda to'g'ridan-to'g'ri shu URL ishlatiladi.
 */
const fromEnv = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

export const API_BASE_URL = import.meta.env.DEV ? "" : (fromEnv ?? "");

/** Backend server manzili (proxy / ma'lumot uchun). */
export const BACKEND_URL = fromEnv || "http://localhost:3000";
