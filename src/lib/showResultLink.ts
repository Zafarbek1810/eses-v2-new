/** Public PDF natija linki — token yo'q, faqat IDlar */

export type ShowResultParams = {
  orderId: number;
  analysisId: number;
  storageId: number;
};

const SHOW_RESULT_PREFIX = "/showresult";

function positiveInt(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function paramsFromTriple(
  a: string | null | undefined,
  b: string | null | undefined,
  c: string | null | undefined,
): ShowResultParams | null {
  const orderId = positiveInt(a);
  const analysisId = positiveInt(b);
  const storageId = positiveInt(c);
  if (orderId == null || analysisId == null || storageId == null) return null;
  return { orderId, analysisId, storageId };
}

/** Hash: #/showresult/1/2/3 */
function pathFromHash(hash: string): string {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return "";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

/** SMS uchun ochiq domen (ixtiyoriy). Bo'sh bo'lsa — joriy origin. */
export function getPublicAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (fromEnv) return fromEnv;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * URL dan parametrlarni o'qish:
 * - #/showresult/1/2/3  (production — Apache rewrite kerak emas)
 * - /showresult/1/2/3   (local Vite / rewrite bo'lsa)
 * - ?orderId&analysisId&storageId
 */
export function parseShowResultParams(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
  hash = typeof window !== "undefined" ? window.location.hash : "",
): ShowResultParams | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const hashPath = pathFromHash(hash).replace(/\/+$/, "") || "";

  // Hash birinchi — production SMS/QR shu formatda
  const hashMatch = hashPath.match(/^\/showresult\/(\d+)\/(\d+)\/(\d+)$/i);
  if (hashMatch) {
    return paramsFromTriple(hashMatch[1], hashMatch[2], hashMatch[3]);
  }

  const pathMatch = path.match(/^\/showresult\/(\d+)\/(\d+)\/(\d+)$/i);
  if (pathMatch) {
    return paramsFromTriple(pathMatch[1], pathMatch[2], pathMatch[3]);
  }

  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromQuery = paramsFromTriple(
    q.get("orderId") ?? q.get("o"),
    q.get("analysisId") ?? q.get("a"),
    q.get("storageId") ?? q.get("onlineStorageId") ?? q.get("s"),
  );
  if (!fromQuery) return null;

  if (/^\/showresult$/i.test(path) || path === "/" || /^\/index\.html$/i.test(path)) {
    return fromQuery;
  }
  if (q.has("showresult")) return fromQuery;
  return null;
}

export function isShowResultRoute(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
  hash = typeof window !== "undefined" ? window.location.hash : "",
): boolean {
  const hashPath = pathFromHash(hash).replace(/\/+$/, "") || "";
  if (/^\/showresult(\/|$)/i.test(hashPath)) return true;

  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/showresult(\/|$)/i.test(path)) return true;

  return parseShowResultParams(pathname, search, hash) != null;
}

/** PIN: IDlar birlashmasi → "1372226" */
export function buildShowResultPin(params: ShowResultParams): string {
  return `${params.orderId}${params.analysisId}${params.storageId}`;
}

/** Relativ path (hash ichida ham shu): /showresult/{orderId}/{analysisId}/{storageId} */
export function buildShowResultPath(params: ShowResultParams): string {
  const { orderId, analysisId, storageId } = params;
  return `${SHOW_RESULT_PREFIX}/${orderId}/${analysisId}/${storageId}`;
}

/**
 * SMS / QR URL.
 * Hash ishlatiladi: https://eses.uz/#/showresult/213/45/44
 * Server faqat / ni ko'radi → 404 yo'q (Apache rewrite shart emas).
 */
export function buildShowResultUrl(
  params: ShowResultParams,
  origin = getPublicAppOrigin(),
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/#${buildShowResultPath(params)}`;
}
