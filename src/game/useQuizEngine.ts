import { useCallback, useEffect, useRef, useState } from 'react';
import { getCategories, loadAllQuestions } from '../data/questionLoader';
import {
  createGuestSession,
  createHostSession,
  getOrCreatePlayerId,
  type GuestSession,
  type HostSession,
} from '../net/peerManager';
import type {
  AnswerRecord,
  ClientMessage,
  GameSettings,
  Player,
  PublicGameState,
  Question,
  RoundAward,
} from '../types/quiz';

const DEFAULT_SETTINGS: GameSettings = {
  roundsCount: 3,
  questionsPerRound: 4,
  timeLimitSeconds: 20,
  socialMode: 'quizmaster',
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface InternalHostState {
  roomCode: string;
  phase: PublicGameState['phase'];
  settings: GameSettings;
  players: Player[];
  currentRound: number;
  currentQuestionIndex: number;
  currentCategory: string | null;
  categoryChoices: string[];
  categoryPickerId: string | null;
  quizmasterId: string | null;
  questionStartTime: number | null;
  roundQuestions: Question[];
  usedQuestionIds: Set<string>;
  currentAnswers: Map<string, { choiceIndex: number; elapsedMs: number }>;
  doubledPlayerIds: Set<string>;
  lastAnswers: AnswerRecord[];
  roundFastest: { playerName: string; elapsedMs: number } | null;
  roundAwards: RoundAward[];
}

export type Role = 'none' | 'host' | 'guest';

export function useQuizEngine() {
  const [myPlayerId] = useState(() => getOrCreatePlayerId());
  const [role, setRole] = useState<Role>('none');
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'connecting' | 'connected' | 'disconnected'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [publicState, setPublicState] = useState<PublicGameState | null>(null);

  const allQuestionsRef = useRef<Question[]>(loadAllQuestions());
  const allCategoriesRef = useRef<string[]>(getCategories(allQuestionsRef.current));

  const hostSessionRef = useRef<HostSession | null>(null);
  const guestSessionRef = useRef<GuestSession | null>(null);
  const hostStateRef = useRef<InternalHostState | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const buildPublicStateFor = useCallback(
    (s: InternalHostState, recipientId: string): PublicGameState => {
      const currentQ = s.roundQuestions[s.currentQuestionIndex] ?? null;
      const isQuizmaster = s.quizmasterId === recipientId;
      const canSeeQuestion =
        s.phase === 'answering' ||
        s.phase === 'reveal' ||
        (s.phase === 'reading' &&
          (s.settings.socialMode === 'simultaneous' || isQuizmaster));

      const canSeeOptions = s.phase === 'answering' || s.phase === 'reveal';

      return {
        roomCode: s.roomCode,
        phase: s.phase,
        settings: s.settings,
        players: s.players,
        currentRound: s.currentRound,
        currentQuestionIndex: s.currentQuestionIndex,
        currentCategory: s.currentCategory,
        categoryChoices: s.categoryChoices,
        categoryPickerId: s.categoryPickerId,
        quizmasterId: s.quizmasterId,
        questionStartTime: s.questionStartTime,
        questionText: canSeeQuestion && currentQ ? currentQ.question : null,
        options: canSeeOptions && currentQ ? currentQ.options : null,
        answeredPlayerIds: [...s.currentAnswers.keys()],
        doubledPlayerIds: [...s.doubledPlayerIds],
        correctIndex: s.phase === 'reveal' && currentQ ? currentQ.correctIndex : null,
        lastAnswers: s.phase === 'reveal' ? s.lastAnswers : [],
        roundAwards: s.phase === 'round_summary' ? s.roundAwards : [],
      };
    },
    []
  );

  const syncAll = useCallback(
    (s: InternalHostState) => {
      setPublicState(buildPublicStateFor(s, myPlayerId));
      hostSessionRef.current?.broadcast((playerId) => ({
        type: 'state_sync',
        state: buildPublicStateFor(s, playerId),
      }));
    },
    [buildPublicStateFor, myPlayerId]
  );

  const finishQuestion = useCallback(
    (s: InternalHostState) => {
      clearTimer();
      const q = s.roundQuestions[s.currentQuestionIndex];
      if (!q) return;

      const records: AnswerRecord[] = [];
      const limitMs = s.settings.timeLimitSeconds * 1000;

      for (const player of s.players) {
        if (s.settings.socialMode === 'quizmaster' && player.id === s.quizmasterId) {
          continue;
        }
        const ans = s.currentAnswers.get(player.id);
        if (!ans) {
          records.push({
            playerId: player.id,
            choiceIndex: -1,
            elapsedMs: limitMs,
            pointsEarned: 0,
            isCorrect: false,
            doubled: s.doubledPlayerIds.has(player.id),
          });
          continue;
        }

        const isCorrect = ans.choiceIndex === q.correctIndex;
        const doubled = s.doubledPlayerIds.has(player.id);
        let points = 0;
        if (isCorrect) {
          const speedRatio = Math.max(0, 1 - ans.elapsedMs / limitMs);
          const base = 500 + Math.round(speedRatio * 500);
          points = doubled ? base * 2 : base;

          if (!s.roundFastest || ans.elapsedMs < s.roundFastest.elapsedMs) {
            s.roundFastest = { playerName: player.name, elapsedMs: ans.elapsedMs };
          }
        }

        player.roundScore += points;
        player.totalScore += points;
        if (doubled) {
          player.doubleAvailable = false;
        }

        records.push({
          playerId: player.id,
          choiceIndex: ans.choiceIndex,
          elapsedMs: ans.elapsedMs,
          pointsEarned: points,
          isCorrect,
          doubled,
        });
      }

      s.lastAnswers = records;
      s.phase = 'reveal';
      syncAll(s);
    },
    [syncAll]
  );

  const beginAnsweringPhase = useCallback(
    (s: InternalHostState) => {
      clearTimer();
      s.phase = 'answering';
      s.questionStartTime = Date.now();
      s.currentAnswers = new Map();
      syncAll(s);

      timerRef.current = window.setTimeout(() => {
        const current = hostStateRef.current;
        if (current && current.phase === 'answering') {
          finishQuestion(current);
        }
      }, s.settings.timeLimitSeconds * 1000);
    },
    [finishQuestion, syncAll]
  );

  const startRoundWithCategory = useCallback(
    (s: InternalHostState, category: string) => {
      const pool = allQuestionsRef.current.filter(
        (q) => q.category === category && !s.usedQuestionIds.has(q.id)
      );
      const fallbackPool =
        pool.length >= s.settings.questionsPerRound
          ? pool
          : allQuestionsRef.current.filter((q) => q.category === category);

      const picked = shuffle(fallbackPool).slice(0, s.settings.questionsPerRound);
      picked.forEach((q) => s.usedQuestionIds.add(q.id));

      s.currentCategory = category;
      s.roundQuestions = picked;
      s.currentQuestionIndex = 0;
      s.currentAnswers = new Map();
      s.doubledPlayerIds = new Set();
      s.lastAnswers = [];
      s.roundFastest = null;
      s.players.forEach((p) => {
        p.roundScore = 0;
      });

      if (s.settings.socialMode === 'simultaneous') {
        beginAnsweringPhase(s);
      } else {
        s.phase = 'reading';
        s.questionStartTime = null;
        syncAll(s);
      }
    },
    [beginAnsweringPhase, syncAll]
  );

  const prepareRoundCategoryPick = useCallback(
    (s: InternalHostState, roundNumber: number) => {
      s.currentRound = roundNumber;
      s.currentCategory = null;
      s.roundQuestions = [];
      s.currentQuestionIndex = 0;

      // Rotate quizmaster fairly across players
      const qmIndex = (roundNumber - 1) % s.players.length;
      s.quizmasterId =
        s.settings.socialMode === 'quizmaster' ? s.players[qmIndex].id : null;

      // In round 1, quizmaster/host picks; in later rounds, lowest-scoring connected player picks!
      if (roundNumber === 1) {
        s.categoryPickerId = s.quizmasterId ?? s.players[0].id;
      } else {
        const candidates = s.players.filter((p) => p.connected);
        const sorted = [...(candidates.length ? candidates : s.players)].sort(
          (a, b) => a.totalScore - b.totalScore
        );
        s.categoryPickerId = sorted[0].id;
      }

      // Pick up to 3 categories that still have unused questions
      const catsWithUnused = allCategoriesRef.current.filter((cat) =>
        allQuestionsRef.current.some(
          (q) => q.category === cat && !s.usedQuestionIds.has(q.id)
        )
      );
      const sourceCats =
        catsWithUnused.length >= 3 ? catsWithUnused : allCategoriesRef.current;
      s.categoryChoices = shuffle(sourceCats).slice(0, 3);
      s.phase = 'category_pick';
      syncAll(s);
    },
    [syncAll]
  );

  const buildRoundSummary = useCallback(
    (s: InternalHostState) => {
      // Award quizmaster the average round score of other players so they don't fall behind
      if (s.settings.socialMode === 'quizmaster' && s.quizmasterId) {
        const others = s.players.filter((p) => p.id !== s.quizmasterId);
        if (others.length > 0) {
          const avg = Math.round(
            others.reduce((sum, p) => sum + p.roundScore, 0) / others.length
          );
          const qm = s.players.find((p) => p.id === s.quizmasterId);
          if (qm) {
            qm.roundScore = avg;
            qm.totalScore += avg;
          }
        }
      }

      const awards: RoundAward[] = [];
      const sortedRound = [...s.players].sort((a, b) => b.roundScore - a.roundScore);
      if (sortedRound[0] && sortedRound[0].roundScore > 0) {
        awards.push({
          title: 'Rundevinner',
          playerName: sortedRound[0].name,
          detail: `${sortedRound[0].roundScore} poeng i runden`,
        });
      }
      if (s.roundFastest) {
        awards.push({
          title: 'Raskest på avtrekkeren',
          playerName: s.roundFastest.playerName,
          detail: `${(s.roundFastest.elapsedMs / 1000).toFixed(1)} sek`,
        });
      }
      s.roundAwards = awards;
      s.phase = 'round_summary';
      syncAll(s);
    },
    [syncAll]
  );

  const handleClientMessage = useCallback(
    (msg: ClientMessage) => {
      const s = hostStateRef.current;
      if (!s) return;

      switch (msg.type) {
        case 'join': {
          const existing = s.players.find((p) => p.id === msg.playerId);
          if (existing) {
            existing.connected = true;
            if (msg.name.trim()) existing.name = msg.name.trim();
          } else {
            s.players.push({
              id: msg.playerId,
              name: msg.name.trim() || `Spiller ${s.players.length + 1}`,
              isHost: false,
              connected: true,
              totalScore: 0,
              roundScore: 0,
              doubleAvailable: true,
            });
          }
          syncAll(s);
          break;
        }

        case 'pick_category': {
          if (s.phase !== 'category_pick') return;
          if (msg.playerId !== s.categoryPickerId && msg.playerId !== myPlayerId) return;
          startRoundWithCategory(s, msg.category);
          break;
        }

        case 'start_answering': {
          if (s.phase !== 'reading') return;
          if (msg.playerId !== s.quizmasterId && msg.playerId !== myPlayerId) return;
          beginAnsweringPhase(s);
          break;
        }

        case 'toggle_double': {
          if (s.phase !== 'reading' && s.phase !== 'answering') return;
          const player = s.players.find((p) => p.id === msg.playerId);
          if (!player || !player.doubleAvailable) return;
          if (s.settings.socialMode === 'quizmaster' && msg.playerId === s.quizmasterId) {
            return;
          }
          if (s.doubledPlayerIds.has(msg.playerId)) {
            s.doubledPlayerIds.delete(msg.playerId);
          } else {
            s.doubledPlayerIds.add(msg.playerId);
          }
          syncAll(s);
          break;
        }

        case 'submit_answer': {
          if (s.phase !== 'answering' || s.questionStartTime === null) return;
          if (s.settings.socialMode === 'quizmaster' && msg.playerId === s.quizmasterId) {
            return;
          }
          if (s.currentAnswers.has(msg.playerId)) return;

          s.currentAnswers.set(msg.playerId, {
            choiceIndex: msg.choiceIndex,
            elapsedMs: Math.max(0, Date.now() - s.questionStartTime),
          });

          const expectedAnswerers = s.players.filter(
            (p) =>
              p.connected &&
              !(s.settings.socialMode === 'quizmaster' && p.id === s.quizmasterId)
          );
          if (
            expectedAnswerers.length > 0 &&
            expectedAnswerers.every((p) => s.currentAnswers.has(p.id))
          ) {
            finishQuestion(s);
          } else {
            syncAll(s);
          }
          break;
        }

        case 'next_step': {
          const isAllowed =
            msg.playerId === myPlayerId || msg.playerId === s.quizmasterId;
          if (!isAllowed) return;

          if (s.phase === 'reveal') {
            const nextIdx = s.currentQuestionIndex + 1;
            if (nextIdx < s.roundQuestions.length) {
              s.currentQuestionIndex = nextIdx;
              s.currentAnswers = new Map();
              s.doubledPlayerIds = new Set();
              s.lastAnswers = [];
              if (s.settings.socialMode === 'simultaneous') {
                beginAnsweringPhase(s);
              } else {
                s.phase = 'reading';
                s.questionStartTime = null;
                syncAll(s);
              }
            } else {
              buildRoundSummary(s);
            }
          } else if (s.phase === 'round_summary') {
            if (s.currentRound < s.settings.roundsCount) {
              prepareRoundCategoryPick(s, s.currentRound + 1);
            } else {
              s.phase = 'final';
              syncAll(s);
            }
          }
          break;
        }
      }
    },
    [
      beginAnsweringPhase,
      buildRoundSummary,
      finishQuestion,
      myPlayerId,
      prepareRoundCategoryPick,
      startRoundWithCategory,
      syncAll,
    ]
  );

  // Public actions
  const startHosting = useCallback(
    (hostName: string) => {
      hostSessionRef.current?.destroy();
      guestSessionRef.current?.destroy();
      hostSessionRef.current = null;
      guestSessionRef.current = null;
      setError(null);
      setRole('host');
      setConnectionStatus('connecting');

      const session = createHostSession({
        hostPlayerId: myPlayerId,
        onReady(roomCode) {
          const initial: InternalHostState = {
            roomCode,
            phase: 'lobby',
            settings: { ...DEFAULT_SETTINGS },
            players: [
              {
                id: myPlayerId,
                name: hostName.trim() || 'Vert',
                isHost: true,
                connected: true,
                totalScore: 0,
                roundScore: 0,
                doubleAvailable: true,
              },
            ],
            currentRound: 0,
            currentQuestionIndex: 0,
            currentCategory: null,
            categoryChoices: [],
            categoryPickerId: null,
            quizmasterId: null,
            questionStartTime: null,
            roundQuestions: [],
            usedQuestionIds: new Set(),
            currentAnswers: new Map(),
            doubledPlayerIds: new Set(),
            lastAnswers: [],
            roundFastest: null,
            roundAwards: [],
          };
          hostStateRef.current = initial;
          setConnectionStatus('connected');
          syncAll(initial);
        },
        onMessage(msg) {
          handleClientMessage(msg);
        },
        onPlayerDisconnect(playerId) {
          const s = hostStateRef.current;
          if (!s) return;
          const p = s.players.find((pl) => pl.id === playerId);
          if (p) {
            p.connected = false;
            syncAll(s);
          }
        },
        onError(err) {
          setError(err);
        },
      });

      hostSessionRef.current = session;
    },
    [handleClientMessage, myPlayerId, syncAll]
  );

  const joinRoom = useCallback(
    (roomCode: string, playerName: string) => {
      hostSessionRef.current?.destroy();
      guestSessionRef.current?.destroy();
      hostSessionRef.current = null;
      guestSessionRef.current = null;
      setError(null);
      setRole('guest');
      setConnectionStatus('connecting');

      const session = createGuestSession({
        roomCode,
        playerId: myPlayerId,
        playerName,
        onConnected() {
          setConnectionStatus('connected');
        },
        onMessage(msg) {
          if (msg.type === 'state_sync') {
            setPublicState(msg.state);
          } else if (msg.type === 'error') {
            setError(msg.message);
          }
        },
        onDisconnected() {
          setConnectionStatus('disconnected');
        },
        onError(err) {
          setError(err);
          setConnectionStatus('disconnected');
        },
      });

      guestSessionRef.current = session;
    },
    [myPlayerId]
  );

  const updateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      const s = hostStateRef.current;
      if (!s || role !== 'host' || s.phase !== 'lobby') return;
      s.settings = { ...s.settings, ...patch };
      syncAll(s);
    },
    [role, syncAll]
  );

  const startGame = useCallback(() => {
    const s = hostStateRef.current;
    if (!s || role !== 'host') return;
    s.usedQuestionIds = new Set();
    s.players.forEach((p) => {
      p.totalScore = 0;
      p.roundScore = 0;
      p.doubleAvailable = true;
    });
    prepareRoundCategoryPick(s, 1);
  }, [prepareRoundCategoryPick, role]);

  const restartToLobby = useCallback(() => {
    const s = hostStateRef.current;
    if (!s || role !== 'host') return;
    clearTimer();
    s.phase = 'lobby';
    s.currentRound = 0;
    s.players.forEach((p) => {
      p.totalScore = 0;
      p.roundScore = 0;
      p.doubleAvailable = true;
    });
    syncAll(s);
  }, [role, syncAll]);

  const sendAction = useCallback(
    (msg: ClientMessage) => {
      if (role === 'host') {
        handleClientMessage(msg);
      } else if (role === 'guest') {
        guestSessionRef.current?.send(msg);
      }
    },
    [handleClientMessage, role]
  );

  const leaveGame = useCallback(() => {
    clearTimer();
    hostSessionRef.current?.destroy();
    hostSessionRef.current = null;
    guestSessionRef.current?.destroy();
    guestSessionRef.current = null;
    hostStateRef.current = null;
    setPublicState(null);
    setRole('none');
    setConnectionStatus('idle');
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
      hostSessionRef.current?.destroy();
      guestSessionRef.current?.destroy();
    };
  }, []);

  return {
    myPlayerId,
    role,
    connectionStatus,
    error,
    state: publicState,
    totalQuestionCount: allQuestionsRef.current.length,
    categoryCount: allCategoriesRef.current.length,
    startHosting,
    joinRoom,
    updateSettings,
    startGame,
    restartToLobby,
    sendAction,
    leaveGame,
  };
}
