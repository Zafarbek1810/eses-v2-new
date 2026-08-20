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

/** Hash: #/showresult/1/2/3 yoki #showresult/1/2/3 */
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
 * - /showresult/1/2/3 (rewrite bo'lsa)
 * - #/showresult/1/2/3
 * - /?orderId=1&analysisId=2&storageId=3  (Apache rewrite kerak emas)
 */
export function parseShowResultParams(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
  hash = typeof window !== "undefined" ? window.location.hash : "",
): ShowResultParams | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const hashPath = pathFromHash(hash).replace(/\/+$/, "") || "";

  const pathMatch = path.match(/^\/showresult\/(\d+)\/(\d+)\/(\d+)$/i);
  if (pathMatch) {
    return paramsFromTriple(pathMatch[1], pathMatch[2], pathMatch[3]);
  }

  const hashMatch = hashPath.match(/^\/showresult\/(\d+)\/(\d+)\/(\d+)$/i);
  if (hashMatch) {
    return paramsFromTriple(hashMatch[1], hashMatch[2], hashMatch[3]);
  }

  const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const fromQuery = paramsFromTriple(
    q.get("orderId") ?? q.get("o"),
    q.get("analysisId") ?? q.get("a"),
    q.get("storageId") ?? q.get("onlineStorageId") ?? q.get("s"),
  );
  if (fromQuery) {
    // /showresult?... yoki bosh sahifa /?... (production Apache uchun)
    if (/^\/showresult$/i.test(path) || path === "/" || /^\/index\.html$/i.test(path)) {
      return fromQuery;
    }
    // Boshqa pathda ham showresult=1 belgilangan bo'lsa
    if (q.get("showresult") === "1" || q.has("showresult")) {
      return fromQuery;
    }
  }

  return null;
}

export function isShowResultRoute(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
  hash = typeof window !== "undefined" ? window.location.hash : "",
): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (/^\/showresult(\/|$)/i.test(path)) return true;

  const hashPath = pathFromHash(hash).replace(/\/+$/, "") || "";
  if (/^\/showresult(\/|$)/i.test(hashPath)) return true;

  // Production: rewrite yo'q — query bilan ochiladi
  return parseShowResultParams(pathname, search, hash) != null;
}

/** PIN: orderId+analysisId+storageId → "1372226" */
export function buildShowResultPin(params: ShowResultParams): string {
  return `${params.orderId}${params.analysisId}${params.storageId}`;
}

/**
 * Relativ path (dev / rewrite bo'lsa).
 * Production SMS uchun buildShowResultUrl query formatini ishlatadi.
 */
export function buildShowResultPath(params: ShowResultParams): string {
  const { orderId, analysisId, storageId } = params;
  return `${SHOW_RESULT_PREFIX}/${orderId}/${analysisId}/${storageId}`;
}

/**
 * To'liq ochiladigan URL (SMS / QR).
 * Query format: Apache rewrite / .htaccess ishlamasa ham / index.html ni topadi.
 */
export function buildShowResultUrl(
  params: ShowResultParams,
  origin = getPublicAppOrigin(),
): string {
  const base = origin.replace(/\/$/, "");
  const q = new URLSearchParams({
    orderId: String(params.orderId),
    analysisId: String(params.analysisId),
    storageId: String(params.storageId),
  });
  return `${base}/?${q.toString()}`;
}
