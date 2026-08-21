export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

/** One browser store: notes kept per user id across logouts. */
export type AiNotesByUser = {
  id: number;
  notes: string[];
};

const CHAT_PREFIX = "ses_ai_demo_chat_";
const NOTES_STORE_KEY = "ses_ai_demo_notes_by_user";
/** Legacy per-user key — migrated once then removed. */
const LEGACY_NOTES_PREFIX = "ses_ai_demo_notes_";

function chatKey(userId: number) {
  return `${CHAT_PREFIX}${userId}`;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readNotesStore(): AiNotesByUser[] {
  const list = readJson<AiNotesByUser[]>(NOTES_STORE_KEY, []);
  if (!Array.isArray(list)) return [];
  return list
    .filter(
      (row): row is AiNotesByUser =>
        row != null
        && typeof row === "object"
        && typeof row.id === "number"
        && Array.isArray(row.notes),
    )
    .map(row => ({
      id: row.id,
      notes: row.notes.filter((n): n is string => typeof n === "string"),
    }));
}

function writeNotesStore(store: AiNotesByUser[]) {
  try {
    localStorage.setItem(NOTES_STORE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota */
  }
}

/** Migrate old `ses_ai_demo_notes_{userId}` entries into the shared array. */
function migrateLegacyNotes(userId: number): string[] | null {
  try {
    const legacyKey = `${LEGACY_NOTES_PREFIX}${userId}`;
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    localStorage.removeItem(legacyKey);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
          return (item as { text: string }).text;
        }
        return null;
      })
      .filter((n): n is string => Boolean(n));
  } catch {
    return null;
  }
}

export function loadAiChat(userId: number): AiChatMessage[] {
  const list = readJson<AiChatMessage[]>(chatKey(userId), []);
  return Array.isArray(list) ? list : [];
}

export function saveAiChat(userId: number, messages: AiChatMessage[]) {
  try {
    localStorage.setItem(chatKey(userId), JSON.stringify(messages));
  } catch {
    /* ignore quota */
  }
}

export function loadAiNotes(userId: number): string[] {
  const store = readNotesStore();
  const existing = store.find(row => row.id === userId);
  if (existing) return [...existing.notes];

  const migrated = migrateLegacyNotes(userId);
  if (migrated == null) return [];

  writeNotesStore([...store, { id: userId, notes: migrated }]);
  return migrated;
}

export function saveAiNotes(userId: number, notes: string[]) {
  const store = readNotesStore();
  const idx = store.findIndex(row => row.id === userId);
  const nextNotes = notes.filter(n => typeof n === "string");

  if (idx >= 0) {
    store[idx] = { id: userId, notes: nextNotes };
  } else {
    store.push({ id: userId, notes: nextNotes });
  }

  writeNotesStore(store);
}

/** Clear chat only — notes stay in localStorage across logout/login. */
export function clearAiDemoStorage(userId: number | null | undefined) {
  if (userId == null) return;
  try {
    localStorage.removeItem(chatKey(userId));
  } catch {
    /* ignore */
  }
}
