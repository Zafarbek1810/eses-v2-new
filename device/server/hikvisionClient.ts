export type HikvisionConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  localAddress?: string;
  /** off | force | fallback — fallback: kamera ulanmasa demo ma'lumot */
  mockMode: "off" | "force" | "fallback";
  gateway?: string;
  /** AcsEvent so'rovlarida timezone, masalan +05:00 (Postman bilan bir xil) */
  timezone: string;
};

const DEFAULT_HOST = "192.168.1.40";
const DEFAULT_USER = "admin";
const DEFAULT_PASSWORD = "A112233a";
const DEFAULT_PORT = 80;

function parseMockMode(value: string | undefined): HikvisionConfig["mockMode"] {
  const normalized = (value || "off").trim().toLowerCase();
  if (["1", "true", "yes", "on", "force"].includes(normalized)) return "force";
  if (["fallback"].includes(normalized)) return "fallback";
  return "off";
}

const DEFAULT_TIMEZONE = "+05:00";

function normalizeTimezone(value: string | undefined): string {
  const tz = (value || DEFAULT_TIMEZONE).trim();
  if (/^[+-]\d{2}:\d{2}$/.test(tz)) return tz;
  return DEFAULT_TIMEZONE;
}

export function createHikvisionConfig(env: Record<string, string>): HikvisionConfig {
  const localAddress = (env.HIKVISION_LOCAL_ADDRESS || env.HIKVISION_BIND || "").trim() || undefined;
  const gateway = (env.HIKVISION_GATEWAY || env.HIKVISION_UPSTREAM || "").trim().replace(/\/$/, "") || undefined;

  return {
    host: (env.HIKVISION_HOST || DEFAULT_HOST).replace(/^https?:\/\//, "").replace(/\/$/, "").trim(),
    port: Number(env.HIKVISION_PORT || DEFAULT_PORT) || DEFAULT_PORT,
    username: (env.HIKVISION_USER || DEFAULT_USER).trim(),
    password: (env.HIKVISION_PASSWORD || DEFAULT_PASSWORD).trim(),
    localAddress,
    mockMode: parseMockMode(env.HIKVISION_MOCK),
    gateway,
    timezone: normalizeTimezone(env.HIKVISION_TIMEZONE),
  };
}

export function hikvisionBaseUrl(config: HikvisionConfig): string {
  const portPart = config.port === 80 ? "" : `:${config.port}`;
  return `http://${config.host}${portPart}`;
}

export function hikvisionUrl(config: HikvisionConfig, path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = config.gateway || hikvisionBaseUrl(config);
  return `${base}${normalized}`;
}
