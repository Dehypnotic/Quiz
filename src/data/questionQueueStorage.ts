import type { Question } from '../types/quiz';

const QUEUE_STORAGE_KEY = 'selskapsquiz_question_queue_v1';

export type QuestionQueueMap = Record<string, number>;

export function loadQuestionQueue(): QuestionQueueMap {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markQuestionsPlayed(questionIds: string[]): void {
  if (questionIds.length === 0) return;
  try {
    const queue = loadQuestionQueue();
    const now = Date.now();
    for (const id of questionIds) {
      queue[id] = now;
    }
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage quota / private mode errors
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Picks `count` questions with even (round-robin) distribution across subcategories,
 * prioritizing:
 * 1. Questions not used in the current game (`excludeIds`)
 * 2. Never-played questions (`lastPlayed === 0`), shuffled randomly
 * 3. Oldest-played questions (furthest back in the queue)
 */
export function pickQueuedQuestions(
  candidates: Question[],
  count: number,
  queue: QuestionQueueMap,
  excludeIds: Set<string>
): Question[] {
  const pickFromPool = (pool: Question[], limit: number): Question[] => {
    const bySubcategory = new Map<string, Question[]>();
    for (const q of pool) {
      const list = bySubcategory.get(q.subcategory);
      if (list) {
        list.push(q);
      } else {
        bySubcategory.set(q.subcategory, [q]);
      }
    }

    const buckets = shuffleArray(
      [...bySubcategory.values()].map((list) =>
        list
          .map((q) => ({
            q,
            lastPlayed: queue[q.id] ?? 0,
            rand: Math.random(),
          }))
          .sort((a, b) =>
            a.lastPlayed !== b.lastPlayed ? a.lastPlayed - b.lastPlayed : a.rand - b.rand
          )
          .map((entry) => entry.q)
      )
    );

    const result: Question[] = [];
    let roundIdx = 0;
    while (result.length < limit) {
      let addedInPass = false;
      for (const bucket of buckets) {
        if (result.length >= limit) break;
        if (roundIdx < bucket.length) {
          result.push(bucket[roundIdx]);
          addedInPass = true;
        }
      }
      if (!addedInPass) break;
      roundIdx++;
    }
    return result;
  };

  const notUsedThisGame = candidates.filter((q) => !excludeIds.has(q.id));
  let picked = pickFromPool(notUsedThisGame, count);

  // If unused questions in this game ran out, top up from previously asked candidates
  if (picked.length < count && candidates.length > picked.length) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const fallbackPool = candidates.filter((q) => !pickedIds.has(q.id));
    const extras = pickFromPool(fallbackPool, count - picked.length);
    picked = [...picked, ...extras];
  }

  return shuffleArray(picked);
}
