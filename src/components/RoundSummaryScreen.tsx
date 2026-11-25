import { Award, Trophy } from 'lucide-react';
import type { PublicGameState } from '../types/quiz';
import { TransferHostCard } from './TransferHostCard';

interface RoundSummaryScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onNext: () => void;
  onTransferHost: (targetPlayerId: string) => void;
}

export function RoundSummaryScreen({
  state,
  myPlayerId,
  isHost,
  onNext,
  onTransferHost,
}: RoundSummaryScreenProps) {
  const isQuizmaster =
    state.settings.socialMode === 'quizmaster' && myPlayerId === state.quizmasterId;
  const canAdvance = isHost || isQuizmaster;
  const isFinalRound = state.currentRound >= state.settings.roundsCount;

  const byRound = [...state.players].sort(
    (a, b) => b.roundScore - a.roundScore || a.totalCorrectMs - b.totalCorrectMs
  );
  const byTotal = [...state.players].sort(
    (a, b) => b.totalScore - a.totalScore || a.totalCorrectMs - b.totalCorrectMs
  );

  return (
    <div className="space-y-5 pb-8">
      <div className="text-center">
        <span className="inline-block rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
          Oppsummering • Runde {state.currentRound}
        </span>
        <h2 className="mt-2 text-2xl font-extrabold text-white">
          {state.currentCategory}
        </h2>
      </div>

      {state.roundAwards.length > 0 && (
        <div className="grid grid-cols-1 gap-2.5">
          {state.roundAwards.map((award) => (
            <div
              key={award.title}
              className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3.5"
            >
              <Award className="h-6 w-6 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {award.title}
                </p>
                <p className="text-sm font-bold text-white">
                  {award.playerName}{' '}
                  <span className="font-normal text-slate-300">({award.detail})</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Poeng i denne runden
        </h3>
        <div className="space-y-2">
          {byRound.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3.5 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 text-center font-bold text-slate-500">
                  {idx + 1}.
                </span>
                <span className="font-semibold text-white">
                  {p.name}
                  {p.id === state.quizmasterId ? ' (Oppleser)' : ''}
                </span>
              </div>
              <span className="font-bold text-emerald-400">+{p.roundScore}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
          <Trophy className="h-3.5 w-3.5 text-amber-400" />
          Sammenlagt toppliste
        </h3>
        <div className="space-y-2">
          {byTotal.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm ${
                idx === 0
                  ? 'border border-amber-500/40 bg-amber-500/10'
                  : 'bg-slate-950/60'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 text-center font-extrabold text-amber-400">
                  {idx + 1}.
                </span>
                <span className="font-bold text-white">{p.name}</span>
              </div>
              <span className="font-extrabold text-white">{p.totalScore} p</span>
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <TransferHostCard
          players={state.players}
          onTransferHost={onTransferHost}
        />
      )}

      {canAdvance ? (
        <button
          type="button"
          onClick={onNext}
          className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-extrabold text-white shadow-lg transition active:scale-[0.99]"
        >
          {isFinalRound ? 'Vis sluttresultat 🏆' : 'Neste runde →'}
        </button>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Venter på at verten starter neste runde...
        </p>
      )}
    </div>
  );
}
