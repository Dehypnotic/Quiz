import { useCallback, useEffect, useRef, useState } from 'react';
import { getCategoryGroups, loadAllQuestions } from '../data/questionLoader';
import {
  loadQuestionQueue,
  markQuestionsPlayed,
  pickQueuedQuestions,
} from '../data/questionQueueStorage';
import {
  clearActiveSession,
  loadActiveSession,
  loadSerializedHostState,
  saveActiveSession,
  saveSerializedHostState,
  type ActiveSessionInfo,
} from '../data/sessionStorage';
import {
  createGuestSession,
  createHostSession,
  getOrCreatePlayerId,
  type GuestSession,
  type HostSession,
} from '../net/peerManager';
import type {
  AnswerRecord,
  CategoryGroup,
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
  socialMode: 'simultaneous',
};

interface InternalHostState {
  roomCode: string;
  phase: PublicGameState['phase'];
  settings: GameSettings;
  players: Player[];
  currentRound: number;
  currentQuestionIndex: number;
  currentCategory: string | null;
  categoryChoices: CategoryGroup[];
  usedCategories: Set<string>;
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
  finishedAt: number | null;
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
  const [resumableSession, setResumableSession] = useState<ActiveSessionInfo | null>(() =>
    loadActiveSession()
  );

  const allQuestionsRef = useRef<Question[]>(loadAllQuestions());
  const allCategoryGroupsRef = useRef<CategoryGroup[]>(
    getCategoryGroups(allQuestionsRef.current)
  );

  const hostSessionRef = useRef<HostSession | null>(null);
  const guestSessionRef = useRef<GuestSession | null>(null);
  const hostStateRef = useRef<InternalHostState | null>(null);
  const timerRef = useRef<number | null>(null);
  const hostSyncDelayRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hostSyncDelayRef.current !== null) {
      window.clearTimeout(hostSyncDelayRef.current);
      hostSyncDelayRef.current = null;
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
        usedCategories: [...s.usedCategories],
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
        finishedAt: s.finishedAt,
      };
    },
    []
  );

  const syncAll = useCallback(
    (s: InternalHostState, delayHostMs = 0) => {
      saveSerializedHostState({
        roomCode: s.roomCode,
        phase: s.phase,
        settings: s.settings,
        players: s.players,
        currentRound: s.currentRound,
        currentQuestionIndex: s.currentQuestionIndex,
        currentCategory: s.currentCategory,
        categoryChoices: s.categoryChoices,
        usedCategories: [...s.usedCategories],
        categoryPickerId: s.categoryPickerId,
        quizmasterId: s.quizmasterId,
        questionStartTime: s.questionStartTime,
        roundQuestions: s.roundQuestions,
        usedQuestionIds: [...s.usedQuestionIds],
        currentAnswers: [...s.currentAnswers.entries()],
        doubledPlayerIds: [...s.doubledPlayerIds],
        lastAnswers: s.lastAnswers,
        roundFastest: s.roundFastest,
        roundAwards: s.roundAwards,
        finishedAt: s.finishedAt,
      });

      hostSessionRef.current?.broadcast((playerId) => ({
        type: 'state_sync',
        state: buildPublicStateFor(s, playerId),
      }));

      const hostSnapshot = buildPublicStateFor(s, myPlayerId);
      if (delayHostMs > 0) {
        if (hostSyncDelayRef.current !== null) {
          window.clearTimeout(hostSyncDelayRef.current);
        }
        hostSyncDelayRef.current = window.setTimeout(() => {
          hostSyncDelayRef.current = null;
          setPublicState(hostSnapshot);
        }, delayHostMs);
      } else {
        setPublicState(hostSnapshot);
      }
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
          points = doubled ? 2 : 1;
          player.totalCorrectMs += ans.elapsedMs;

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
      s.questionStartTime = Date.now() + 300;
      s.currentAnswers = new Map();
      // Broadcast to guests first, delay host UI slightly so options appear together
      syncAll(s, 300);

      timerRef.current = window.setTimeout(() => {
        const current = hostStateRef.current;
        if (current && current.phase === 'answering') {
          finishQuestion(current);
        }
      }, s.settings.timeLimitSeconds * 1000 + 1000);
    },
    [finishQuestion, syncAll]
  );

  const startRoundWithCategory = useCallback(
    (s: InternalHostState, category: string, subcategories?: string[] | null) => {
      const group = allCategoryGroupsRef.current.find((g) => g.category === category);
      const allSubNames = group?.subcategories.map((sub) => sub.name) ?? [];
      const selectedSubs =
        subcategories && subcategories.length > 0 ? subcategories : allSubNames;
      const allSelected = !group || selectedSubs.length >= allSubNames.length;

      const matches = (q: Question) =>
        q.category === category &&
        (allSelected || selectedSubs.includes(q.subcategory));

      const queue = loadQuestionQueue();
      const directMatches = allQuestionsRef.current.filter(matches);

      let picked = pickQueuedQuestions(
        directMatches,
        s.settings.questionsPerRound,
        queue,
        s.usedQuestionIds
      );

      // If selected subcategories have fewer questions than questionsPerRound, top up from same main category
      if (!allSelected && picked.length < s.settings.questionsPerRound) {
        const pickedIds = new Set([...s.usedQuestionIds, ...picked.map((q) => q.id)]);
        const categoryPool = allQuestionsRef.current.filter(
          (q) => q.category === category
        );
        const needed = s.settings.questionsPerRound - picked.length;
        const extras = pickQueuedQuestions(categoryPool, needed, queue, pickedIds);
        picked = [...picked, ...extras];
      }

      picked.forEach((q) => s.usedQuestionIds.add(q.id));
      markQuestionsPlayed(picked.map((q) => q.id));

      const label = allSelected
        ? category
        : selectedSubs.length === 1
          ? `${category} • ${selectedSubs[0]}`
          : `${category} (${selectedSubs.join(', ')})`;

      s.currentCategory = label;
      if (allSelected) {
        s.usedCategories.add(category);
      }
      selectedSubs.forEach((sub) => s.usedCategories.add(`${category} • ${sub}`));
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

      s.categoryChoices = getCategoryGroups(
        allQuestionsRef.current,
        s.usedQuestionIds
      );
      s.phase = 'category_pick';
      syncAll(s);
    },
    [syncAll]
  );

  const buildRoundSummary = useCallback(
    (s: InternalHostState) => {
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
              totalCorrectMs: 0,
              doubleAvailable: true,
            });
          }
          syncAll(s);
          break;
        }

        case 'pick_category': {
          if (s.phase !== 'category_pick') return;
          if (msg.playerId !== s.categoryPickerId && msg.playerId !== myPlayerId) return;
          startRoundWithCategory(s, msg.category, msg.subcategories);
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
          if (s.currentAnswers.has(msg.playerId)) return;

          const limitMs = s.settings.timeLimitSeconds * 1000;
          const fallbackElapsed = Math.max(0, Date.now() - s.questionStartTime);
          const elapsedMs =
            typeof msg.clientElapsedMs === 'number'
              ? Math.max(0, Math.min(limitMs, msg.clientElapsedMs))
              : Math.min(limitMs, fallbackElapsed);

          s.currentAnswers.set(msg.playerId, {
            choiceIndex: msg.choiceIndex,
            elapsedMs,
          });

          const expectedAnswerers = s.players.filter((p) => p.connected);
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
              s.finishedAt = Date.now();
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
                totalCorrectMs: 0,
                doubleAvailable: true,
              },
            ],
            currentRound: 0,
            currentQuestionIndex: 0,
            currentCategory: null,
            categoryChoices: [],
            usedCategories: new Set(),
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
            finishedAt: null,
          };
          hostStateRef.current = initial;
          setConnectionStatus('connected');
          saveActiveSession({
            role: 'host',
            roomCode,
            playerName: hostName.trim() || 'Vert',
          });
          setResumableSession(null);
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
          setError(null);
          setConnectionStatus('connected');
          saveActiveSession({
            role: 'guest',
            roomCode: roomCode.trim().toUpperCase(),
            playerName: playerName.trim(),
          });
          setResumableSession(null);
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
    s.usedCategories = new Set();
    s.finishedAt = null;
    s.players.forEach((p) => {
      p.totalScore = 0;
      p.roundScore = 0;
      p.totalCorrectMs = 0;
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
    s.finishedAt = null;
    s.players.forEach((p) => {
      p.totalScore = 0;
      p.roundScore = 0;
      p.totalCorrectMs = 0;
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

  const reconnectGuest = useCallback(() => {
    if (role === 'guest') {
      setConnectionStatus('connecting');
      guestSessionRef.current?.reconnect();
    }
  }, [role]);

  const leaveGame = useCallback(() => {
    clearTimer();
    hostSessionRef.current?.destroy();
    hostSessionRef.current = null;
    guestSessionRef.current?.destroy();
    guestSessionRef.current = null;
    hostStateRef.current = null;
    clearActiveSession();
    setResumableSession(null);
    setPublicState(null);
    setRole('none');
    setConnectionStatus('idle');
    setError(null);
  }, []);

  const dismissResumableSession = useCallback(() => {
    clearActiveSession();
    setResumableSession(null);
  }, []);

  const resumeSession = useCallback(() => {
    const saved = loadActiveSession();
    if (!saved) {
      setResumableSession(null);
      return;
    }

    if (saved.role === 'guest') {
      joinRoom(saved.roomCode, saved.playerName);
      return;
    }

    const rawHost = loadSerializedHostState();
    if (!rawHost) {
      clearActiveSession();
      setResumableSession(null);
      return;
    }

    const restored: InternalHostState = {
      roomCode: rawHost.roomCode,
      phase: rawHost.phase,
      settings: rawHost.settings,
      players: rawHost.players.map((p) =>
        p.id === myPlayerId ? { ...p, connected: true } : p
      ),
      currentRound: rawHost.currentRound,
      currentQuestionIndex: rawHost.currentQuestionIndex,
      currentCategory: rawHost.currentCategory,
      categoryChoices: rawHost.categoryChoices,
      usedCategories: new Set(rawHost.usedCategories),
      categoryPickerId: rawHost.categoryPickerId,
      quizmasterId: rawHost.quizmasterId,
      questionStartTime: rawHost.questionStartTime,
      roundQuestions: rawHost.roundQuestions,
      usedQuestionIds: new Set(rawHost.usedQuestionIds),
      currentAnswers: new Map(rawHost.currentAnswers),
      doubledPlayerIds: new Set(rawHost.doubledPlayerIds),
      lastAnswers: rawHost.lastAnswers,
      roundFastest: rawHost.roundFastest,
      roundAwards: rawHost.roundAwards,
      finishedAt: rawHost.finishedAt,
    };

    hostSessionRef.current?.destroy();
    guestSessionRef.current?.destroy();
    hostSessionRef.current = null;
    guestSessionRef.current = null;
    setError(null);
    setRole('host');
    setConnectionStatus('connecting');

    const session = createHostSession({
      hostPlayerId: myPlayerId,
      roomCode: restored.roomCode,
      initialKnownPlayerIds: restored.players.map((p) => p.id),
      onReady() {
        hostStateRef.current = restored;
        setConnectionStatus('connected');
        setResumableSession(null);
        syncAll(restored);

        if (restored.phase === 'answering' && restored.questionStartTime !== null) {
          const remainingMs = Math.max(
            0,
            restored.settings.timeLimitSeconds * 1000 +
              1000 -
              (Date.now() - restored.questionStartTime)
          );
          if (remainingMs > 0) {
            clearTimer();
            timerRef.current = window.setTimeout(() => {
              const current = hostStateRef.current;
              if (current && current.phase === 'answering') {
                finishQuestion(current);
              }
            }, remainingMs);
          } else {
            finishQuestion(restored);
          }
        }
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
  }, [finishQuestion, handleClientMessage, joinRoom, myPlayerId, syncAll]);

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
    categoryCount: allCategoryGroupsRef.current.length,
    startHosting,
    joinRoom,
    updateSettings,
    startGame,
    restartToLobby,
    sendAction,
    reconnectGuest,
    leaveGame,
    resumableSession,
    resumeSession,
    dismissResumableSession,
  };
}
