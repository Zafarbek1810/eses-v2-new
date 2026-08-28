import crypto from "node:crypto";
import http from "node:http";
import { URL } from "node:url";

type DigestChallenge = {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
};

export type DigestResponse = {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

function md5(value: string) {
  return crypto.createHash("md5").update(value).digest("hex");
}

function parseWwwAuthenticate(header: string): DigestChallenge | null {
  const realm = header.match(/realm="([^"]+)"/i)?.[1] ?? header.match(/realm=([^,\s]+)/i)?.[1];
  const nonce = header.match(/nonce="([^"]+)"/i)?.[1] ?? header.match(/nonce=([^,\s]+)/i)?.[1];
  if (!realm || !nonce) return null;

  return {
    realm,
    nonce,
    qop: header.match(/qop="([^"]+)"/i)?.[1],
    opaque: header.match(/opaque="([^"]+)"/i)?.[1],
    algorithm: header.match(/algorithm="?([^",\s]+)"?/i)?.[1],
  };
}

function buildDigestAuth(params: {
  username: string;
  password: string;
  method: string;
  uri: string;
  challenge: DigestChallenge;
}): string {
  const { username, password, method, uri, challenge } = params;
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);

  if (challenge.qop) {
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");
    const qop = challenge.qop.split(",")[0]?.trim().replace(/"/g, "") || "auth";
    const response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const opaque = challenge.opaque ? `, opaque="${challenge.opaque}"` : "";
    const algorithm = challenge.algorithm ? `, algorithm=${challenge.algorithm}` : ", algorithm=MD5";
    return `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}"${algorithm}, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${response}"${opaque}`;
  }

  const response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
  return `Digest username="${username}", realm="${challenge.realm}", nonce="${challenge.nonce}", uri="${uri}", response="${response}"`;
}

function formatNodeError(error: unknown, host: string): Error {
  if (!(error instanceof Error)) return new Error("Kamera bilan bog'lanib bo'lmadi");

  const code = (error as NodeJS.ErrnoException).code;
  if (code === "EHOSTUNREACH" || code === "ENETUNREACH") {
    return new Error(
      `Kamera tarmog'iga ulanib bo'lmadi (${host}). `
      + "Mac Wi-Fi orqali boshqa qurilmalarga ulanmayapti (router ishlaydi, kamera yo'q). "
      + "Ethernet kabel bilan ulang yoki routerda AP Isolation ni o'chiring.",
    );
  }
  if (code === "ECONNREFUSED") {
    return new Error(`Kamera javob bermayapti (${host}). Port yoki IP noto'g'ri bo'lishi mumkin.`);
  }
  if (code === "ETIMEDOUT" || error.message.includes("vaqti tugadi")) {
    return new Error(`Kamera bilan bog'lanish vaqti tugadi (${host}).`);
  }

  return error;
}

function httpRequest(options: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  localAddress?: string;
}): Promise<DigestResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(options.url);
    const headers = { ...options.headers };
    if (options.body) {
      headers["Content-Length"] = Buffer.byteLength(options.body).toString();
    }

    const req = http.request(
      {
        host: parsed.hostname,
        port: parsed.port || 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers,
        family: 4,
        localAddress: options.localAddress,
        timeout: options.timeoutMs ?? 20_000,
      },
      res => {
        const chunks: Buffer[] = [];
        res.on("data", chunk => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Kamera bilan bog'lanish vaqti tugadi (${parsed.hostname})`));
    });
    req.on("error", error => reject(formatNodeError(error, parsed.hostname)));

    if (options.body) req.write(options.body);
    req.end();
  });
}

async function authorizedRequest(
  url: string,
  init: {
    method: string;
    headers?: Record<string, string>;
    body?: string;
    username: string;
    password: string;
    localAddress?: string;
  },
  digestUri: string,
  challenge: DigestChallenge,
): Promise<DigestResponse> {
  const authorization = buildDigestAuth({
    username: init.username,
    password: init.password,
    method: init.method,
    uri: digestUri,
    challenge,
  });

  return httpRequest({
    url,
    method: init.method,
    headers: {
      ...init.headers,
      Authorization: authorization,
    },
    body: init.body,
    localAddress: init.localAddress,
  });
}

export async function digestFetch(
  url: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    username: string;
    password: string;
    localAddress?: string;
  },
): Promise<DigestResponse> {
  const method = init.method ?? "GET";
  const parsed = new URL(url);
  const fullUri = `${parsed.pathname}${parsed.search}`;
  const pathUri = parsed.pathname;

  let first: DigestResponse;
  try {
    first = await httpRequest({
      url,
      method,
      headers: init.headers,
      body: init.body,
      localAddress: init.localAddress,
    });
  } catch (error) {
    throw formatNodeError(error, parsed.hostname);
  }

  if (first.statusCode !== 401 && first.statusCode !== 407) {
    return first;
  }

  const wwwAuthHeader = first.headers["www-authenticate"] ?? first.headers["proxy-authenticate"];
  const challengeHeader = Array.isArray(wwwAuthHeader) ? wwwAuthHeader[0] : wwwAuthHeader;
  if (!challengeHeader) {
    throw new Error("Digest auth javobi olinmadi (WWW-Authenticate yo'q)");
  }

  const challenge = parseWwwAuthenticate(challengeHeader);
  if (!challenge) {
    throw new Error(`Digest auth parametrlari o'qilmadi: ${challengeHeader.slice(0, 120)}`);
  }

  const authInit = { ...init, method };

  let authed = await authorizedRequest(url, authInit, fullUri, challenge);
  if (authed.statusCode === 401 && fullUri !== pathUri) {
    authed = await authorizedRequest(url, authInit, pathUri, challenge);
  }

  if (authed.statusCode === 401) {
    const snippet = authed.body.toString("utf8").slice(0, 200);
    throw new Error(`Digest auth rad etildi (401). Login/parolni tekshiring. ${snippet}`);
  }

  return authed;
}

export function testCameraTcp(host: string, port: number, timeoutMs = 3000, localAddress?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host,
      port,
      path: "/",
      method: "GET",
      family: 4,
      localAddress,
      timeout: timeoutMs,
    }, res => {
      res.resume();
      resolve();
    });
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`TCP timeout (${host}:${port})`));
    });
    req.on("error", error => reject(formatNodeError(error, host)));
    req.end();
  });
}
