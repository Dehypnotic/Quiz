import { RotateCcw, Trophy } from 'lucide-react';
import type { PublicGameState } from '../types/quiz';

interface FinalResultsScreenProps {
  state: PublicGameState;
  isHost: boolean;
  onRestart: () => void;
}

export function FinalResultsScreen({
  state,
  isHost,
  onRestart,
}: FinalResultsScreenProps) {
  const ranked = [...state.players].sort((a, b) => b.totalScore - a.totalScore);
  const winner = ranked[0];

  return (
    <div className="space-y-6 pt-4 pb-8">
      <div className="rounded-3xl border border-amber-500/40 bg-gradient-to-b from-amber-500/20 to-slate-900 p-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20 text-amber-300">
          <Trophy className="h-9 w-9" />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
          Vinner av SelskapsQuiz
        </p>
        <h2 className="mt-1 text-3xl font-black text-white">
          {winner?.name ?? 'Ingen'}
        </h2>
        <p className="mt-1 text-base font-bold text-amber-200">
          {winner?.totalScore ?? 0} poeng
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          Endelig resultatliste
        </h3>
        <div className="space-y-2.5">
          {ranked.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-2xl bg-slate-950/70 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-black text-slate-400">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}
                </span>
                <span className="font-bold text-white">{p.name}</span>
              </div>
              <span className="text-base font-extrabold text-indigo-300">
                {p.totalScore} p
              </span>
            </div>
          ))}
        </div>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-slate-950 shadow-lg transition active:scale-[0.99]"
        >
          <RotateCcw className="h-5 w-5" />
          Spill en ny runde (tilbake til lobby)
        </button>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Venter på at verten starter et nytt spill...
        </p>
      )}
    </div>
  );
}
