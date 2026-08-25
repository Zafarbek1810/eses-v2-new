const AI_CHAT_URL = "https://mental.5858.uz/root/nexus_sendMsg_https";
const AI_CHAT_TOKEN =
  "example_token";
// const AI_CHAT_TOKEN =
//   "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhYmR1bGxhZXZkYWRheG9uN0BnbWFpbC5jb20iLCJpYXQiOjE3ODc2Njc3Nzh9.HbhZ6furha9Gh7pW8ysEfsz7fgcRBqpY7c44Hiu-L4o";

export type SendAiMessageOptions = {
  msg: string;
  files?: File[];
};

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

function parseJsonPayload(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function extractReply(raw: string): string {
  const parsed = parseJsonPayload(raw);
  if (!parsed) return raw;

  if (typeof parsed.statusCode === "number" && parsed.statusCode >= 400) {
    const msg =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : "Sun'iy intelekt javob bermadi";
    throw new Error(msg);
  }

  for (const key of ["answer_msg", "items", "message", "msg", "reply", "text", "data"]) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return raw;
}

export async function sendAiMessage({
  msg,
  files = [],
}: SendAiMessageOptions): Promise<string> {
  const form = new FormData();
  form.append("msg", msg);
  for (const file of files) {
    form.append("file", file);
  }

  const res = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      accept: "*/*",
      authorization: `Bearer ${AI_CHAT_TOKEN}`,
      // Content-Type qo'yilmaydi — brauzer multipart boundary ni o'zi qo'yadi
    },
    body: form,
  });

  const raw = await readStreamText(res);

  if (!res.ok) {
    const parsed = parseJsonPayload(raw);
    const msg =
      (parsed && typeof parsed.message === "string" && parsed.message) ||
      (parsed && typeof parsed.error === "string" && parsed.error) ||
      "Sun'iy intelekt javob bermadi";
    throw new Error(msg);
  }

  if (!raw) {
    throw new Error("Javob bo'sh qaytdi");
  }

  const reply = cleanAiReply(extractReply(raw));
  if (!reply) {
    throw new Error("Javob bo'sh qaytdi");
  }

  return reply;
}
