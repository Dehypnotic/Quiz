import { useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Layers, Mic, Shuffle } from 'lucide-react';
import type { CategoryGroup, PublicGameState } from '../types/quiz';

interface CategoryPickScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onPickCategory: (category: string, subcategory?: string | null) => void;
}

export function CategoryPickScreen({
  state,
  myPlayerId,
  isHost,
  onPickCategory,
}: CategoryPickScreenProps) {
  const [expandedGroup, setExpandedGroup] = useState<CategoryGroup | null>(null);

  const picker = state.players.find((p) => p.id === state.categoryPickerId);
  const quizmaster = state.players.find((p) => p.id === state.quizmasterId);
  const isMyTurnToPick = myPlayerId === state.categoryPickerId;
  const canPick = isMyTurnToPick || isHost;

  const isGroupUsed = (group: CategoryGroup) =>
    state.usedCategories.includes(group.category) ||
    group.subcategories.every((sub) =>
      state.usedCategories.includes(`${group.category} • ${sub}`)
    );

  return (
    <div className="space-y-5 pt-4 pb-8">
      <div className="text-center">
        <span className="inline-block rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-indigo-300">
          Runde {state.currentRound} av {state.settings.roundsCount}
        </span>

        {isMyTurnToPick ? (
          <>
            <h2 className="mt-3 text-2xl font-extrabold text-white">
              {expandedGroup ? expandedGroup.category : 'Velg kategori for runden'}
            </h2>
            <p className="mt-1.5 text-sm font-medium text-emerald-300">
              {expandedGroup
                ? 'Velg blanding eller en spesifikk underkategori'
                : 'Din tur til å velge!'}
            </p>
          </>
        ) : (
          <>
            <h2 className="mt-3 text-2xl font-extrabold text-white">
              {picker?.name ?? 'Verten'} velger kategori
            </h2>
            <p className="mt-1.5 text-sm text-slate-400">
              {isHost
                ? `Venter på ${picker?.name ?? 'spiller'} (du kan også velge som vert).`
                : 'Neste runde starter straks – her er kategoriene:'}
            </p>
          </>
        )}

        {quizmaster && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
            <Mic className="h-3.5 w-3.5" />
            Oppleser denne runden: {quizmaster.name}
          </p>
        )}
      </div>

      {expandedGroup ? (
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={() => setExpandedGroup(null)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Alle hovedkategorier
          </button>

          <button
            type="button"
            disabled={!canPick}
            onClick={() => onPickCategory(expandedGroup.category, null)}
            className="flex w-full items-center justify-between rounded-2xl border border-indigo-500/50 bg-indigo-500/15 p-4 text-left transition hover:bg-indigo-500/25 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/25 text-indigo-300">
                <Shuffle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-base font-bold text-white">
                  Blanding (alle underkategorier)
                </span>
                {state.usedCategories.includes(expandedGroup.category) && (
                  <span className="ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                    Spilt
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Velg →
            </span>
          </button>

          {expandedGroup.subcategories.map((sub) => {
            const key = `${expandedGroup.category} • ${sub}`;
            const isUsed = state.usedCategories.includes(key);
            return (
              <button
                key={sub}
                type="button"
                disabled={!canPick}
                onClick={() => onPickCategory(expandedGroup.category, sub)}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  isUsed
                    ? 'border-slate-800 bg-slate-900/60 hover:border-indigo-500 hover:bg-slate-800'
                    : 'border-slate-700 bg-slate-900 hover:border-indigo-500 hover:bg-slate-800'
                } active:scale-[0.99]`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                      isUsed
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {isUsed ? <Check className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-white">{sub}</span>
                    {isUsed && (
                      <span className="ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                        Spilt
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Velg →
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2.5">
          {state.categoryChoices.map((group) => {
            const isUsed = isGroupUsed(group);
            return (
              <button
                key={group.category}
                type="button"
                disabled={!canPick}
                onClick={() => {
                  if (group.subcategories.length > 1) {
                    setExpandedGroup(group);
                  } else {
                    onPickCategory(group.category, null);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition ${
                  canPick
                    ? isUsed
                      ? 'border-slate-800 bg-slate-900/60 hover:border-indigo-500 hover:bg-slate-800 active:scale-[0.99]'
                      : 'border-slate-700 bg-slate-900 hover:border-indigo-500 hover:bg-slate-800 active:scale-[0.99]'
                    : isUsed
                      ? 'border-slate-800/60 bg-slate-900/35 opacity-60'
                      : 'border-slate-800/80 bg-slate-900/50 opacity-85'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isUsed
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-indigo-600/20 text-indigo-400'
                    }`}
                  >
                    {isUsed ? <Check className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white">{group.category}</span>
                      {isUsed && (
                        <span className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Spilt
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 line-clamp-1">
                      {group.subcategories.join(' • ')}
                    </p>
                  </div>
                </div>
                {canPick && <ChevronRight className="h-5 w-5 shrink-0 text-indigo-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
