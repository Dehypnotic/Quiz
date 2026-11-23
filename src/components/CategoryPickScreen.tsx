import { Layers, Mic } from 'lucide-react';
import type { PublicGameState } from '../types/quiz';

interface CategoryPickScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onPickCategory: (category: string) => void;
}

export function CategoryPickScreen({
  state,
  myPlayerId,
  isHost,
  onPickCategory,
}: CategoryPickScreenProps) {
  const picker = state.players.find((p) => p.id === state.categoryPickerId);
  const quizmaster = state.players.find((p) => p.id === state.quizmasterId);
  const canPick = myPlayerId === state.categoryPickerId || isHost;

  return (
    <div className="space-y-6 pt-4">
      <div className="text-center">
        <span className="inline-block rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
          Runde {state.currentRound} av {state.settings.roundsCount}
        </span>
        <h2 className="mt-3 text-2xl font-extrabold text-white">
          Velg kategori for runden
        </h2>
        {quizmaster && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Mic className="h-3.5 w-3.5" />
            Oppleser denne runden: {quizmaster.name}
          </p>
        )}
      </div>

      {myPlayerId === state.categoryPickerId ? (
        <p className="text-center text-sm text-emerald-300 font-medium">
          Din tur til å velge kategori!
        </p>
      ) : (
        <p className="text-center text-sm text-slate-400">
          Venter på at <strong className="text-white">{picker?.name ?? 'spiller'}</strong>{' '}
          velger kategori...
        </p>
      )}

      <div className="space-y-3">
        {state.categoryChoices.map((cat) => (
          <button
            key={cat}
            type="button"
            disabled={!canPick}
            onClick={() => onPickCategory(cat)}
            className={`flex w-full items-center justify-between rounded-2xl border p-5 text-left transition ${
              canPick
                ? 'border-slate-700 bg-slate-900 hover:border-indigo-500 hover:bg-slate-800 active:scale-[0.99]'
                : 'border-slate-800/80 bg-slate-900/50 opacity-70'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/20 text-indigo-400">
                <Layers className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-white">{cat}</span>
            </div>
            {canPick && (
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                Velg →
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
