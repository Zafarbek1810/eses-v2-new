const AI_CHAT_URL = "https://test.5858.uz/api/sendMsg_https";
export const AI_CHAT_EMAIL = "abdullaevdadaxon7@gmail.com";

export type SendMsgResponse = {
  status: number;
  items: string;
};

/** Strip trailing FINISHED marker from model reply. */
export function cleanAiReply(raw: string): string {
  return raw.replace(/\s*FINISHED\s*$/i, "").trim();
}

export async function sendAiMessage(prompt: string): Promise<string> {
  const res = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: AI_CHAT_EMAIL,
      prompt,
    }),
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const msg =
      parsed && typeof parsed === "object" && typeof (parsed as { message?: unknown }).message === "string"
        ? (parsed as { message: string }).message
        : "Sun'iy intelekt javob bermadi";
    throw new Error(msg);
  }

  const data = parsed as SendMsgResponse;
  if (typeof data?.items !== "string") {
    throw new Error("Noto'g'ri javob formati");
  }

  return cleanAiReply(data.items);
}
