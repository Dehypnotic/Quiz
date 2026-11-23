import { useEffect, useState } from 'react';
import { CheckCircle2, Flame, Mic, Volume2 } from 'lucide-react';
import type { PublicGameState } from '../types/quiz';

interface QuestionScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onStartAnswering: () => void;
  onToggleDouble: () => void;
  onSubmitAnswer: (choiceIndex: number) => void;
}

const OPTION_STYLES = [
  'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20',
  'border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20',
  'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20',
  'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20',
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function QuestionScreen({
  state,
  myPlayerId,
  isHost,
  onStartAnswering,
  onToggleDouble,
  onSubmitAnswer,
}: QuestionScreenProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(
    state.settings.timeLimitSeconds * 1000
  );

  const me = state.players.find((p) => p.id === myPlayerId);
  const quizmaster = state.players.find((p) => p.id === state.quizmasterId);
  const isQuizmaster =
    state.settings.socialMode === 'quizmaster' && myPlayerId === state.quizmasterId;
  const hasAnswered = state.answeredPlayerIds.includes(myPlayerId);
  const isDoubled = state.doubledPlayerIds.includes(myPlayerId);

  useEffect(() => {
    setSelectedChoice(null);
  }, [state.currentRound, state.currentQuestionIndex, state.phase]);

  useEffect(() => {
    if (state.phase !== 'answering' || state.questionStartTime === null) return;
    const limitMs = state.settings.timeLimitSeconds * 1000;
    const update = () => {
      const elapsed = Date.now() - state.questionStartTime!;
      setRemainingMs(Math.max(0, limitMs - elapsed));
    };
    update();
    const id = window.setInterval(update, 100);
    return () => window.clearInterval(id);
  }, [state.phase, state.questionStartTime, state.settings.timeLimitSeconds]);

  const expectedAnswerers = state.players.filter(
    (p) =>
      p.connected &&
      !(state.settings.socialMode === 'quizmaster' && p.id === state.quizmasterId)
  ).length;

  const progressPct = Math.max(
    0,
    Math.min(100, (remainingMs / (state.settings.timeLimitSeconds * 1000)) * 100)
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
        <span className="rounded-full bg-slate-900 border border-slate-800 px-3 py-1 text-indigo-300">
          {state.currentCategory}
        </span>
        <span>
          Spørsmål {state.currentQuestionIndex + 1} / {state.settings.questionsPerRound}
        </span>
      </div>

      {state.phase === 'reading' && (
        <div className="space-y-5">
          {isQuizmaster ? (
            <div className="rounded-3xl border border-amber-500/40 bg-amber-500/10 p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-300">
                <Mic className="h-4 w-4" />
                Du er oppleser – les spørsmålet høyt!
              </div>
              <p className="text-xl font-bold leading-snug text-white">
                {state.questionText}
              </p>
              <button
                type="button"
                onClick={onStartAnswering}
                className="w-full rounded-2xl bg-amber-400 py-4 text-base font-extrabold text-slate-950 shadow-lg transition active:scale-[0.99]"
              >
                Vis svaralternativer & start tid
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400">
                <Volume2 className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <p className="text-lg font-bold text-white">
                  Lytt til {quizmaster?.name ?? 'oppleseren'}!
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  Svaralternativene dukker opp straks spørsmålet er lest opp.
                </p>
              </div>

              {me?.doubleAvailable && (
                <button
                  type="button"
                  onClick={onToggleDouble}
                  className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold transition ${
                    isDoubled
                      ? 'border-amber-400 bg-amber-400/20 text-amber-300'
                      : 'border-slate-700 bg-slate-800 text-slate-300'
                  }`}
                >
                  <Flame className="h-4 w-4" />
                  {isDoubled
                    ? 'Dobbel innsats aktivert!'
                    : 'Sats dobbelt på dette spørsmålet (1 per spill)'}
                </button>
              )}

              {isHost && (
                <button
                  type="button"
                  onClick={onStartAnswering}
                  className="block w-full rounded-xl border border-slate-700 py-2.5 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Vert: Tving frem alternativer nå
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {state.phase === 'answering' && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold">
              <span className="text-slate-400">Tid igjen</span>
              <span className={remainingMs < 5000 ? 'text-rose-400' : 'text-white'}>
                {Math.ceil(remainingMs / 1000)}s
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full transition-all duration-100 ${
                  remainingMs < 5000 ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-lg font-bold leading-snug text-white">
              {state.questionText}
            </p>
          </div>

          {isQuizmaster ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-center space-y-2">
              <p className="text-sm font-semibold text-amber-300">
                Spillerne svarer nå...
              </p>
              <p className="text-2xl font-black text-white">
                {state.answeredPlayerIds.length} / {expectedAnswerers}
              </p>
              <p className="text-xs text-slate-400">har avgitt svar</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {state.options?.map((opt, idx) => {
                const isPicked = selectedChoice === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={hasAnswered}
                    onClick={() => {
                      setSelectedChoice(idx);
                      onSubmitAnswer(idx);
                    }}
                    className={`flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                      isPicked
                        ? 'border-white bg-indigo-600 text-white shadow-lg'
                        : hasAnswered
                          ? 'border-slate-800 bg-slate-900/40 text-slate-500'
                          : `${OPTION_STYLES[idx]} text-white`
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-950/60 text-sm font-extrabold">
                      {OPTION_LETTERS[idx]}
                    </span>
                    <span className="text-base font-semibold leading-tight">{opt}</span>
                  </button>
                );
              })}

              {hasAnswered && (
                <div className="flex items-center justify-center gap-2 pt-2 text-sm font-semibold text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Svar registrert! Venter på de andre ({state.answeredPlayerIds.length}/
                  {expectedAnswerers})
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
