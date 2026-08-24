import { getAccessToken } from "./session";
import { BACKEND_URL } from "./config";

const GEMINI_URL = `${BACKEND_URL}/gemini`;

export type GeminiResponse = {
  answer_msg?: string;
  message?: string;
  error?: string | { message?: string; code?: number; status?: string };
};

/** Strip trailing FINISHED marker from model reply. */
export function cleanAiReply(raw: string): string {
  return raw.replace(/\s*FINISHED\s*$/i, "").trim();
}

function parseGeminiError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const raw = record.error ?? record.message;
  if (raw == null) return null;

  let nested: unknown = raw;
  if (typeof raw === "string") {
    try {
      nested = JSON.parse(raw);
    } catch {
      return raw.trim() || null;
    }
  }

  if (nested && typeof nested === "object") {
    const outer = nested as Record<string, unknown>;
    const inner = (outer.error ?? outer) as Record<string, unknown>;
    const msg = typeof inner.message === "string" ? inner.message : null;
    if (msg) {
      if (/leaked|PERMISSION_DENIED|API key/i.test(msg)) {
        return "Gemini API kaliti oqib ketgan yoki yaroqsiz. Serverda yangi kalit sozlang.";
      }
      return msg;
    }
  }

  return typeof raw === "string" ? raw : null;
}

export async function sendAiMessage(prompt: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ msg: prompt }),
  });

  let parsed: GeminiResponse | null = null;
  const text = await res.text();
  if (text) {
    try {
      parsed = JSON.parse(text) as GeminiResponse;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    throw new Error(
      parseGeminiError(parsed) ?? "Sun'iy intelekt javob bermadi",
    );
  }

  const apiError = parseGeminiError(parsed);
  if (apiError) {
    throw new Error(apiError);
  }

  const reply = cleanAiReply(
    typeof parsed?.answer_msg === "string" ? parsed.answer_msg : "",
  );

  if (!reply) {
    throw new Error("Javob bo'sh qaytdi");
  }

  return reply;
}
