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

export function getCategoryGroups(
  questions: Question[],
  usedQuestionIds: Set<string> = new Set()
): CategoryGroup[] {
  const map = new Map<
    string,
    Map<string, { total: number; available: number }>
  >();

  for (const q of questions) {
    if (!map.has(q.category)) {
      map.set(q.category, new Map());
    }
    const subMap = map.get(q.category)!;
    const entry = subMap.get(q.subcategory) ?? { total: 0, available: 0 };
    entry.total += 1;
    if (!usedQuestionIds.has(q.id)) {
      entry.available += 1;
    }
    subMap.set(q.subcategory, entry);
  }

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'nb'))
    .map(([category, subMap]) => {
      const subcategories = [...subMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'nb'))
        .map(([name, counts]) => ({
          name,
          availableCount: counts.available,
          totalCount: counts.total,
        }));

      const totalCount = subcategories.reduce((s, sub) => s + sub.totalCount, 0);
      const availableCount = subcategories.reduce(
        (s, sub) => s + sub.availableCount,
        0
      );

      return {
        category,
        availableCount,
        totalCount,
        subcategories,
      };
    });
}
