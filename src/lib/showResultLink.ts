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

/** SMS uchun ochiq domen (ixtiyoriy). Bo'sh bo'lsa — joriy origin. */
export function getPublicAppOrigin(): string {
  const fromEnv = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );
  if (fromEnv) return fromEnv;
  return typeof window !== "undefined" ? window.location.origin : "";
}

/** URL dan parametrlarni o'qish: /showresult/1/2/3 yoki ?orderId&analysisId&storageId */
export function parseShowResultParams(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
  search = typeof window !== "undefined" ? window.location.search : "",
): ShowResultParams | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  const pathMatch = path.match(/^\/showresult\/(\d+)\/(\d+)\/(\d+)$/i);
  if (pathMatch) {
    return {
      orderId: Number(pathMatch[1]),
      analysisId: Number(pathMatch[2]),
      storageId: Number(pathMatch[3]),
    };
  }

  if (!/^\/showresult$/i.test(path)) return null;

  const q = new URLSearchParams(search);
  const orderId = positiveInt(q.get("orderId") ?? q.get("o"));
  const analysisId = positiveInt(q.get("analysisId") ?? q.get("a"));
  const storageId = positiveInt(
    q.get("storageId") ?? q.get("onlineStorageId") ?? q.get("s"),
  );
  if (orderId == null || analysisId == null || storageId == null) return null;
  return { orderId, analysisId, storageId };
}

export function isShowResultRoute(
  pathname = typeof window !== "undefined" ? window.location.pathname : "",
): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return /^\/showresult(\/|$)/i.test(path);
}

/** PIN: /showresult/137/22/26 → "1372226" */
export function buildShowResultPin(params: ShowResultParams): string {
  return `${params.orderId}${params.analysisId}${params.storageId}`;
}

/** Relativ path: /showresult/{orderId}/{analysisId}/{storageId} */
export function buildShowResultPath(params: ShowResultParams): string {
  const { orderId, analysisId, storageId } = params;
  return `${SHOW_RESULT_PREFIX}/${orderId}/${analysisId}/${storageId}`;
}

/** To'liq ochiladigan URL (SMS uchun) */
export function buildShowResultUrl(
  params: ShowResultParams,
  origin = getPublicAppOrigin(),
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}${buildShowResultPath(params)}`;
}
