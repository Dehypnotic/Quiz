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

/**
 * Picks `count` questions prioritizing:
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
  const notUsedThisGame = candidates.filter((q) => !excludeIds.has(q.id));
  const pool = notUsedThisGame.length > 0 ? notUsedThisGame : candidates;

  const withRandom = pool.map((q) => ({
    q,
    lastPlayed: queue[q.id] ?? 0,
    rand: Math.random(),
  }));

  withRandom.sort((a, b) => {
    if (a.lastPlayed !== b.lastPlayed) {
      return a.lastPlayed - b.lastPlayed;
    }
    return a.rand - b.rand;
  });

  return withRandom.slice(0, count).map((entry) => entry.q);
}
