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
  phase?: PublicGameState['phase'];
  hostTabId?: string;
  savedAt: number;
}

export interface SerializedHostState {
  roomCode: string;
  groupName?: string | null;
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
    const currentTabId = sessionStorage.getItem('selskapsquiz_tab_id') ?? undefined;
    const payload: ActiveSessionInfo = {
      ...info,
      hostTabId: info.role === 'host' ? (info.hostTabId ?? currentTabId) : undefined,
      savedAt: Date.now(),
    };
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function isOtherHostTabActive(info: ActiveSessionInfo): boolean {
  if (info.role !== 'host' || !info.hostTabId) return false;
  try {
    const myTabId = sessionStorage.getItem('selskapsquiz_tab_id');
    if (myTabId && info.hostTabId === myTabId) return false;
    const raw = localStorage.getItem('selskapsquiz_open_tabs');
    if (!raw) return false;
    const tabs = JSON.parse(raw) as Record<string, { playerId: string; ts: number }>;
    const hostTab = tabs[info.hostTabId];
    return Boolean(hostTab && Date.now() - hostTab.ts < 10_000);
  } catch {
    return false;
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
      const hostParsed = JSON.parse(hostRaw) as SerializedHostState;
      parsed.phase = hostParsed.phase;
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
