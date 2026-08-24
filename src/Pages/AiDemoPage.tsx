import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, NotebookPen, Plus, Send, Trash2 } from "lucide-react";
import { sendAiMessage } from "@/api/aiChat";
import { getStoredUser } from "@/api/session";
import {
  loadAiChat,
  saveAiChat,
  loadAiNotes,
  saveAiNotes,
  type AiChatMessage,
} from "@/lib/aiChatStorage";

type AiDemoPageProps = {
  primaryColor: string;
};

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** ChatGPT uslubida chapdan o'ngga harfma-harf yozish. */
async function typewriterReveal(
  fullText: string,
  onUpdate: (partial: string) => void,
  signal?: { cancelled: boolean },
): Promise<void> {
  const chars = Array.from(fullText);
  let shown = "";

  for (let i = 0; i < chars.length; i++) {
    if (signal?.cancelled) return;
    shown += chars[i];
    onUpdate(shown);

    const ch = chars[i];
    const next = chars[i + 1];
    let delay = 18;
    if (ch === "\n") delay = 80;
    else if (/[.!?]/.test(ch) && (!next || /\s/.test(next))) delay = 120;
    else if (/[,;:]/.test(ch)) delay = 45;
    else if (ch === " ") delay = 12;

    await new Promise<void>(resolve => {
      window.setTimeout(resolve, delay);
    });
  }
}

export function AiDemoPage({ primaryColor }: AiDemoPageProps) {
  const userId = getStoredUser()?.id ?? 0;
  const [messages, setMessages] = useState<AiChatMessage[]>(() =>
    userId ? loadAiChat(userId) : [],
  );
  const [notes, setNotes] = useState<string[]>(() =>
    userId ? loadAiNotes(userId) : [],
  );
  const [input, setInput] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typeCancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  useEffect(() => {
    if (!userId) return;
    // Typing jarayonida har harfda localStorage yozilmasin
    if (typingId) return;
    saveAiChat(userId, messages);
  }, [userId, messages, typingId]);

  useEffect(() => {
    if (!userId) return;
    saveAiNotes(userId, notes);
  }, [userId, notes]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, typingId]);

  useEffect(() => {
    return () => {
      typeCancelRef.current.cancelled = true;
    };
  }, []);

  const handleSend = async () => {
    const prompt = input.trim();
    if (!prompt || sending || !userId) return;

    const userMsg: AiChatMessage = {
      id: newId(),
      role: "user",
      content: prompt,
      createdAt: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setError(null);
    setSending(true);

    try {
      const reply = await sendAiMessage(prompt);
      const fullReply = reply || "Javob bo'sh qaytdi.";
      const assistantId = newId();
      const assistantMsg: AiChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      setSending(false);
      setTypingId(assistantId);

      typeCancelRef.current = { cancelled: false };
      await typewriterReveal(
        fullReply,
        partial => {
          setMessages(prev =>
            prev.map(m => (m.id === assistantId ? { ...m, content: partial } : m)),
          );
        },
        typeCancelRef.current,
      );

      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content: fullReply } : m)),
      );
      setTypingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xatolik yuz berdi");
      setSending(false);
      setTypingId(null);
    } finally {
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    setNotes(prev => [text, ...prev]);
    setNoteDraft("");
  };

  const removeNote = (index: number) => {
    setNotes(prev => prev.filter((_, i) => i !== index));
  };

  const clearChat = () => {
    typeCancelRef.current.cancelled = true;
    setMessages([]);
    setError(null);
    setTypingId(null);
    setSending(false);
  };

  const saveMessageAsNote = (content: string) => {
    const text = content.trim();
    if (!text) return;
    setNotes(prev => [text, ...prev]);
  };

  const busy = sending || typingId != null;

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2.9fr)_minmax(280px,1fr)]">
        {/* Chat */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Bot className="h-4 w-4" style={{ color: primaryColor }} />
              Chat
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="text-xs text-muted-foreground transition-colors hover:text-destructive"
              >
                Tarixni tozalash
              </button>
            )}
          </div>

          <div className="ses-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.length === 0 && !sending && (
              <div className="m-auto max-w-sm text-center text-sm text-muted-foreground">
                <Bot className="mx-auto mb-2 h-10 w-10 opacity-40" />
                Savolingizni yozing — sun&apos;iy intelekt javob beradi.
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`group relative max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "rounded-br-md text-white"
                      : "rounded-bl-md border border-border bg-muted/50 text-foreground"
                  }`}
                  style={
                    msg.role === "user"
                      ? { backgroundColor: primaryColor }
                      : undefined
                  }
                >
                  {msg.content}
                  {msg.role === "assistant" && typingId === msg.id && (
                    <span
                      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse align-baseline"
                      style={{ backgroundColor: primaryColor }}
                      aria-hidden
                    />
                  )}
                  {msg.role === "assistant" && typingId !== msg.id && msg.content && (
                    <button
                      type="button"
                      title="Eslatmaga qo'shish"
                      onClick={() => saveMessageAsNote(msg.content)}
                      className="absolute -right-1 -top-1 hidden rounded-full border border-border bg-card p-1 text-muted-foreground shadow-sm group-hover:flex hover:text-foreground"
                    >
                      <NotebookPen className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border bg-muted/50 px-3.5 py-2.5 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" style={{ color: primaryColor }} />
                  Javob yozilmoqda…
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Xabar yozing… (Enter — yuborish)"
                disabled={busy}
                className="ses-scrollbar min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 disabled:opacity-60"
                style={{ ["--tw-ring-color" as string]: primaryColor }}
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={busy || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
                style={{ backgroundColor: primaryColor }}
                aria-label="Yuborish"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Notes */}
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(12,31,28,0.04)]">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            <NotebookPen className="h-4 w-4" style={{ color: primaryColor }} />
            Eslatmalar
          </div>

          <div className="border-b border-border p-3">
            <div className="flex gap-2">
              <input
                value={noteDraft}
                onChange={e => setNoteDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addNote();
                  }
                }}
                placeholder="Yangi eslatma…"
                className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2"
                style={{ ["--tw-ring-color" as string]: primaryColor }}
              />
              <button
                type="button"
                onClick={addNote}
                disabled={!noteDraft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-40"
                style={{ backgroundColor: primaryColor }}
                aria-label="Qo'shish"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="ses-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            {notes.length === 0 ? (
              <p className="m-auto text-center text-sm text-muted-foreground">
                Hozircha eslatma yo&apos;q
              </p>
            ) : (
              notes.map((note, index) => (
                <div
                  key={`${index}-${note.slice(0, 24)}`}
                  className="group flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
                >
                  <p className="min-w-0 flex-1 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                    {note}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeNote(index)}
                    className="shrink-0 rounded-md p-1 text-muted-foreground opacity-60 transition-opacity hover:text-destructive group-hover:opacity-100"
                    aria-label="O'chirish"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
