export interface HistoryPlayerResult {
  playerId?: string;
  name: string;
  totalScore: number;
  totalCorrectMs: number;
}

export interface QuizHistoryEntry {
  id: string;
  finishedAt: string;
  roomCode: string;
  groupName?: string;
  roundsCount: number;
  categories: string[];
  players: HistoryPlayerResult[];
}

const STORAGE_KEY = 'selskapsquiz_history_v1';
const MAX_ENTRIES = 50;

export function loadHistory(): QuizHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: QuizHistoryEntry): void {
  try {
    const existing = loadHistory();
    if (existing.some((e) => e.id === entry.id)) return;
    const next = [entry, ...existing].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

export function deleteHistoryEntry(id: string): QuizHistoryEntry[] {
  const next = loadHistory().filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function formatHistoryDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatHistoryEntryAsText(entry: QuizHistoryEntry): string {
  const dateStr = formatHistoryDate(entry.finishedAt);
  const cats = entry.categories.length > 0 ? entry.categories.join(', ') : 'Blandet';
  const lines = [
    `SelskapsQuiz (${dateStr})`,
    `Kategorier: ${cats}`,
    '',
    ...entry.players.map((p, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      return `${medal} ${p.name}: ${p.totalScore} p (${(p.totalCorrectMs / 1000).toFixed(1)}s)`;
    }),
  ];
  return lines.join('\n');
}
