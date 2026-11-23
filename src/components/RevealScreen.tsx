import { Check, Flame, X } from 'lucide-react';
import type { PublicGameState } from '../types/quiz';

interface RevealScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onNext: () => void;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export function RevealScreen({
  state,
  myPlayerId,
  isHost,
  onNext,
}: RevealScreenProps) {
  const isQuizmaster =
    state.settings.socialMode === 'quizmaster' && myPlayerId === state.quizmasterId;
  const canAdvance = isHost || isQuizmaster;
  const isLastQuestion =
    state.currentQuestionIndex + 1 >= state.settings.questionsPerRound;

  const myRecord = state.lastAnswers.find((a) => a.playerId === myPlayerId);

  return (
    <div className="space-y-5 pb-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
          Fasit • {state.currentCategory}
        </p>
        <p className="mt-1.5 text-base font-bold text-white">{state.questionText}</p>

        <div className="mt-4 space-y-2">
          {state.options?.map((opt, idx) => {
            const isCorrect = idx === state.correctIndex;
            return (
              <div
                key={idx}
                className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                  isCorrect
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200'
                    : 'border-slate-800 bg-slate-950/50 text-slate-500'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-extrabold">{OPTION_LETTERS[idx]}</span>
                  <span>{opt}</span>
                </div>
                {isCorrect && <Check className="h-4 w-4 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      </div>

      {myRecord && (
        <div
          className={`rounded-2xl border p-4 text-center ${
            myRecord.isCorrect
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
          }`}
        >
          <p className="text-lg font-extrabold">
            {myRecord.isCorrect
              ? `Riktig! +${myRecord.pointsEarned} poeng`
              : myRecord.choiceIndex === -1
                ? 'Tiden rant ut!'
                : 'Dessverre feil!'}
          </p>
          {myRecord.doubled && (
            <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-300">
              <Flame className="h-3.5 w-3.5" /> Dobbel innsats brukt
            </p>
          )}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Spillernes svar
        </h3>
        <div className="space-y-2">
          {state.lastAnswers.map((ans) => {
            const player = state.players.find((p) => p.id === ans.playerId);
            if (!player) return null;
            return (
              <div
                key={ans.playerId}
                className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-2">
                  {ans.isCorrect ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <X className="h-4 w-4 text-rose-400" />
                  )}
                  <span className="font-medium text-white">{player.name}</span>
                  {ans.doubled && <Flame className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <span className="font-bold text-slate-300">
                  {ans.pointsEarned > 0 ? `+${ans.pointsEarned}` : '0'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {canAdvance ? (
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-extrabold text-white shadow-lg transition active:scale-[0.99]"
        >
          {isLastQuestion ? 'Se rundeoppsummering →' : 'Neste spørsmål →'}
        </button>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Venter på at verten eller oppleseren går videre...
        </p>
      )}
    </div>
  );
}
