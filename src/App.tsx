import { useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { CategoryPickScreen } from './components/CategoryPickScreen';
import { FinalResultsScreen } from './components/FinalResultsScreen';
import { HomeScreen } from './components/HomeScreen';
import { LobbyScreen } from './components/LobbyScreen';
import { QuestionScreen } from './components/QuestionScreen';
import { RevealScreen } from './components/RevealScreen';
import { RoundSummaryScreen } from './components/RoundSummaryScreen';
import { saveHistoryEntry } from './data/historyStorage';
import { useQuizEngine } from './game/useQuizEngine';

export function App() {
  const {
    myPlayerId,
    role,
    connectionStatus,
    error,
    state,
    totalQuestionCount,
    categoryCount,
    startHosting,
    joinRoom,
    updateSettings,
    startGame,
    restartToLobby,
    sendAction,
    reconnectGuest,
    leaveGame,
  } = useQuizEngine();

  useEffect(() => {
    if (!state || state.phase !== 'final' || !state.finishedAt) return;
    const ranked = [...state.players].sort(
      (a, b) => b.totalScore - a.totalScore || a.totalCorrectMs - b.totalCorrectMs
    );
    saveHistoryEntry({
      id: `${state.roomCode}-${state.finishedAt}`,
      finishedAt: new Date(state.finishedAt).toISOString(),
      roomCode: state.roomCode,
      roundsCount: state.settings.roundsCount,
      categories: state.usedCategories,
      players: ranked.map((p) => ({
        name: p.name,
        totalScore: p.totalScore,
        totalCorrectMs: p.totalCorrectMs,
      })),
    });
  }, [state]);

  if (role === 'none' || !state) {
    return (
      <HomeScreen
        totalQuestions={totalQuestionCount}
        categoryCount={categoryCount}
        error={error}
        connecting={connectionStatus === 'connecting'}
        onHost={startHosting}
        onJoin={joinRoom}
      />
    );
  }

  const isHost = role === 'host';

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pt-4">
      <header className="mb-4 flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/70 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-indigo-600/20 px-2 py-0.5 text-xs font-extrabold tracking-widest text-indigo-300">
            {state.roomCode}
          </span>
          {state.currentRound > 0 && state.phase !== 'final' && (
            <span className="text-xs font-medium text-slate-400">
              Runde {state.currentRound}/{state.settings.roundsCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={leaveGame}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
          Forlat
        </button>
      </header>

      {(connectionStatus === 'disconnected' || connectionStatus === 'connecting') && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
          <span>
            {connectionStatus === 'connecting'
              ? 'Kobler til på nytt...'
              : error || 'Mistet forbindelsen til verten.'}
          </span>
          {!isHost && connectionStatus === 'disconnected' && (
            <button
              type="button"
              onClick={reconnectGuest}
              className="shrink-0 rounded-xl bg-rose-500 px-3 py-1.5 font-bold text-white active:scale-95"
            >
              Koble til på nytt
            </button>
          )}
        </div>
      )}

      {state.phase === 'lobby' && (
        <LobbyScreen
          state={state}
          isHost={isHost}
          onUpdateSettings={updateSettings}
          onStartGame={startGame}
        />
      )}

      {state.phase === 'category_pick' && (
        <CategoryPickScreen
          state={state}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onPickCategory={(category, subcategories) =>
            sendAction({
              type: 'pick_category',
              playerId: myPlayerId,
              category,
              subcategories,
            })
          }
        />
      )}

      {(state.phase === 'reading' || state.phase === 'answering') && (
        <QuestionScreen
          state={state}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onStartAnswering={() =>
            sendAction({ type: 'start_answering', playerId: myPlayerId })
          }
          onToggleDouble={() =>
            sendAction({ type: 'toggle_double', playerId: myPlayerId })
          }
          onSubmitAnswer={(choiceIndex, clientElapsedMs) =>
            sendAction({
              type: 'submit_answer',
              playerId: myPlayerId,
              choiceIndex,
              clientElapsedMs,
            })
          }
        />
      )}

      {state.phase === 'reveal' && (
        <RevealScreen
          state={state}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onNext={() => sendAction({ type: 'next_step', playerId: myPlayerId })}
        />
      )}

      {state.phase === 'round_summary' && (
        <RoundSummaryScreen
          state={state}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onNext={() => sendAction({ type: 'next_step', playerId: myPlayerId })}
        />
      )}

      {state.phase === 'final' && (
        <FinalResultsScreen
          state={state}
          isHost={isHost}
          onRestart={restartToLobby}
        />
      )}
    </div>
  );
}
export default App;
