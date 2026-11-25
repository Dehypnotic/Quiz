import type {
  AnswerRecord,
  CategoryGroup,
  GameSettings,
  Player,
  PublicGameState,
  Question,
  RoundAward,
} from '../types/quiz';

const ACTIVE_SESSION_KEY = 'selskapsquiz_active_session';
const HOST_STATE_KEY = 'selskapsquiz_host_state';
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export interface ActiveSessionInfo {
  role: 'host' | 'guest';
  roomCode: string;
  playerName: string;
  savedAt: number;
}

export interface SerializedHostState {
  roomCode: string;
  phase: PublicGameState['phase'];
  settings: GameSettings;
  players: Player[];
  currentRound: number;
  currentQuestionIndex: number;
  currentCategory: string | null;
  categoryChoices: CategoryGroup[];
  usedCategories: string[];
  categoryPickerId: string | null;
  quizmasterId: string | null;
  questionStartTime: number | null;
  roundQuestions: Question[];
  usedQuestionIds: string[];
  currentAnswers: [string, { choiceIndex: number; elapsedMs: number }][];
  doubledPlayerIds: string[];
  lastAnswers: AnswerRecord[];
  roundFastest: { playerName: string; elapsedMs: number } | null;
  roundAwards: RoundAward[];
  finishedAt: number | null;
  savedAt: number;
}

export function saveActiveSession(info: Omit<ActiveSessionInfo, 'savedAt'>): void {
  try {
    const payload: ActiveSessionInfo = { ...info, savedAt: Date.now() };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadActiveSession(): ActiveSessionInfo | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSessionInfo;
    if (!parsed.roomCode || !parsed.role || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
      clearActiveSession();
      return null;
    }
    if (parsed.role === 'host') {
      const hostRaw = localStorage.getItem(HOST_STATE_KEY);
      if (!hostRaw) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSerializedHostState(state: Omit<SerializedHostState, 'savedAt'>): void {
  try {
    const payload: SerializedHostState = { ...state, savedAt: Date.now() };
    localStorage.setItem(HOST_STATE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSerializedHostState(): SerializedHostState | null {
  try {
    const raw = localStorage.getItem(HOST_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SerializedHostState;
    if (!parsed.roomCode || !parsed.savedAt) return null;
    if (Date.now() - parsed.savedAt > SESSION_MAX_AGE_MS) {
      clearActiveSession();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(HOST_STATE_KEY);
  } catch {
    // Ignore
  }
}
