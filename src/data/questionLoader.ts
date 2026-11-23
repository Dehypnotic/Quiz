import rawQuestions from './questions.json';
import type { Question, QuestionRaw } from '../types/quiz';

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
  return (rawQuestions as QuestionRaw[]).map((raw) => ({
    id: raw.id,
    category: raw.category,
    question: raw.question,
    options: raw.options,
    correctIndex: decodeAnswerToken(raw.answerToken, raw.id),
  }));
}

export function getCategories(questions: Question[]): string[] {
  return [...new Set(questions.map((q) => q.category))].sort((a, b) =>
    a.localeCompare(b, 'nb')
  );
}
