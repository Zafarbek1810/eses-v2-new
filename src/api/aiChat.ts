const NEXUS_ORIGIN = "https://nexus.5858.uz";
const NEXUS_API_PATH = "/api/nexus/privat/v1/secure_url";
const AI_CHAT_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhYmR1bGxhZXZkMzQ4QGdtYWlsLmNvbSIsImlhdCI6MTc4NzU1MTI1M30._Vjy1KAUE5AUJb4uGSr_EDxnrf9iEdFdOsVbJ_C08Q8";

/** Dev: Vite proxy (same-origin). Prod: to'g'ridan-to'g'ri Nexus. */
const nexusBase = import.meta.env.DEV ? NEXUS_API_PATH : `${NEXUS_ORIGIN}${NEXUS_API_PATH}`;

const authHeaders = {
  accept: "*/*",
  authorization: `Bearer ${AI_CHAT_TOKEN}`,
} as const;

/** Strip trailing FINISHED marker from model reply. */
export function cleanAiReply(raw: string): string {
  return raw.replace(/\s*FINISHED\s*$/i, "").trim();
}

async function readStreamText(res: Response): Promise<string> {
  if (!res.body) {
    return (await res.text()).trim();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text.trim();
}

async function verifyAiToken(): Promise<void> {
  const res = await fetch(`${nexusBase}/verifyToken`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: "{}",
  });

  const payload = await res.json().catch(() => null) as { statusCode?: number } | null;
  if (!res.ok || payload?.statusCode !== 200) {
    throw new Error("Sun'iy intelekt tokeni tasdiqlanmadi");
  }
}

export async function sendAiMessage(prompt: string): Promise<string> {
  await verifyAiToken();

  const res = await fetch(`${nexusBase}/sendMsg`, {
    method: "POST",
    headers: {
      ...authHeaders,
      "content-type": "application/json",
    },
    body: JSON.stringify({ msg: prompt }),
  });

  if (!res.ok) {
    throw new Error("Sun'iy intelekt javob bermadi");
  }

  const reply = cleanAiReply(await readStreamText(res));
  if (!reply) {
    throw new Error("Javob bo'sh qaytdi");
  }

  return reply;
}
