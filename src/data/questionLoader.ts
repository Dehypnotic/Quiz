import type { CategoryGroup, Question, QuestionRaw } from '../types/quiz';

const questionModules = import.meta.glob<{ default: QuestionRaw[] }>(
  './questions/*.json',
  { eager: true }
);

function decodeAnswerToken(token: string, expectedId: string): number {
  try {
    const bytes = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const sep = decoded.lastIndexOf(':');
    if (sep === -1) return 0;
    const id = decoded.slice(0, sep);
    const idx = Number(decoded.slice(sep + 1));
    if (id !== expectedId || !Number.isInteger(idx) || idx < 0 || idx > 3) {
      return 0;
    }
    return idx;
  } catch {
    return 0;
  }
}

export function loadAllQuestions(): Question[] {
  const all: Question[] = [];
  for (const mod of Object.values(questionModules)) {
    const list = Array.isArray(mod.default) ? mod.default : [];
    for (const raw of list) {
      all.push({
        id: raw.id,
        category: raw.category,
        subcategory: raw.subcategory || 'Generelt',
        question: raw.question,
        options: raw.options,
        correctIndex: decodeAnswerToken(raw.answerToken, raw.id),
      });
    }
  }
  return all;
}

export function getCategoryGroups(questions: Question[]): CategoryGroup[] {
  const map = new Map<string, Set<string>>();
  for (const q of questions) {
    if (!map.has(q.category)) {
      map.set(q.category, new Set());
    }
    map.get(q.category)!.add(q.subcategory);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'nb'))
    .map(([category, subs]) => ({
      category,
      subcategories: [...subs].sort((a, b) => a.localeCompare(b, 'nb')),
    }));
}
