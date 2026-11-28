import type { SerializedHostState } from '../data/sessionStorage';

export type SocialMode = 'quizmaster' | 'simultaneous';

export type GamePhase =
  | 'lobby'
  | 'category_pick'
  | 'reading'
  | 'answering'
  | 'reveal'
  | 'round_summary'
  | 'final';

export interface QuestionRaw {
  id: string;
  category: string;
  subcategory?: string;
  question: string;
  options: [string, string, string, string];
  answerToken: string;
  addedAt?: string;
}

export interface Question {
  id: string;
  category: string;
  subcategory: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  addedAt?: string;
}

export interface SubcategoryInfo {
  name: string;
  availableCount: number;
  totalCount: number;
}

export interface CategoryGroup {
  category: string;
  availableCount: number;
  totalCount: number;
  subcategories: SubcategoryInfo[];
}

export interface GameSettings {
  roundsCount: number;
  questionsPerRound: number;
  timeLimitSeconds: number;
  socialMode: SocialMode;
}

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  connected: boolean;
  totalScore: number;
  roundScore: number;
  totalCorrectMs: number;
  doubleAvailable: boolean;
}

export interface AnswerRecord {
  playerId: string;
  choiceIndex: number;
  elapsedMs: number;
  pointsEarned: number;
  isCorrect: boolean;
  doubled: boolean;
}

export interface RoundAward {
  title: string;
  playerName: string;
  detail: string;
}

export interface PublicQuestionView {
  id: string;
  category: string;
  question: string;
  options: [string, string, string, string];
}

/**
 * State sent from Host to all Guests.
 * Notice: `correctIndex` is NEVER included until phase === 'reveal'!
 */
export interface PublicGameState {
  roomCode: string;
  groupName?: string | null;
  phase: GamePhase;
  settings: GameSettings;
  players: Player[];
  currentRound: number; // 1-indexed
  currentQuestionIndex: number; // 0-indexed within round
  currentCategory: string | null;
  categoryChoices: CategoryGroup[];
  usedCategories: string[];
  categoryPickerId: string | null;
  quizmasterId: string | null;
  questionStartTime: number | null; // epoch ms when answering started
  /** Only populated for the quizmaster during 'reading', or for everyone during 'answering'/'reveal' */
  questionText: string | null;
  /** Populated during 'answering' and 'reveal' */
  options: [string, string, string, string] | null;
  /** Player IDs who have submitted an answer for the current question */
  answeredPlayerIds: string[];
  /** Player IDs who activated double-points for the current question */
  doubledPlayerIds: string[];
  /** Populated only during 'reveal' */
  correctIndex: number | null;
  /** Populated only during 'reveal' */
  lastAnswers: AnswerRecord[];
  /** Populated during 'round_summary' */
  roundAwards: RoundAward[];
  /** Epoch ms when phase became 'final' */
  finishedAt: number | null;
}

export type ClientMessage =
  | { type: 'join'; playerId: string; name: string }
  | { type: 'pick_category'; playerId: string; category: string; subcategories?: string[] | null }
  | { type: 'start_answering'; playerId: string }
  | { type: 'toggle_double'; playerId: string }
  | { type: 'submit_answer'; playerId: string; choiceIndex: number; clientElapsedMs?: number }
  | { type: 'next_step'; playerId: string };

export type HostMessage =
  | { type: 'state_sync'; state: PublicGameState }
  | { type: 'host_handover'; hostState: SerializedHostState }
  | { type: 'error'; message: string };
