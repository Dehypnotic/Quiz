import { useState } from 'react';
import { ArrowLeft, Check, Layers, Mic, SlidersHorizontal } from 'lucide-react';
import type { CategoryGroup, PublicGameState } from '../types/quiz';

interface CategoryPickScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onPickCategory: (category: string, subcategories?: string[] | null) => void;
}

export function CategoryPickScreen({
  state,
  myPlayerId,
  isHost,
  onPickCategory,
}: CategoryPickScreenProps) {
  const [expandedGroup, setExpandedGroup] = useState<CategoryGroup | null>(null);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);

  const picker = state.players.find((p) => p.id === state.categoryPickerId);
  const quizmaster = state.players.find((p) => p.id === state.quizmasterId);
  const isMyTurnToPick = myPlayerId === state.categoryPickerId;
  const canPick = isMyTurnToPick || isHost;

  const isGroupUsed = (group: CategoryGroup) =>
    state.usedCategories.includes(group.category) ||
    group.subcategories.every((sub) =>
      state.usedCategories.includes(`${group.category} • ${sub}`)
    );

  const openGroup = (group: CategoryGroup) => {
    setExpandedGroup(group);
    setSelectedSubs([...group.subcategories]);
  };

  const toggleSub = (sub: string) => {
    setSelectedSubs((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

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
                ? 'Huk av eller på underkategoriene du vil ha med'
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
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
              onClick={() =>
                setSelectedSubs(
                  selectedSubs.length === expandedGroup.subcategories.length
                    ? []
                    : [...expandedGroup.subcategories]
                )
              }
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-indigo-300 hover:bg-slate-800"
            >
              {selectedSubs.length === expandedGroup.subcategories.length
                ? 'Fjern alle'
                : 'Velg alle'}
            </button>
          </div>

          <div className="space-y-2">
            {expandedGroup.subcategories.map((sub) => {
              const checked = selectedSubs.includes(sub);
              const isUsed = state.usedCategories.includes(
                `${expandedGroup.category} • ${sub}`
              );
              return (
                <button
                  key={sub}
                  type="button"
                  onClick={() => toggleSub(sub)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                    checked
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-slate-800 bg-slate-900/50 opacity-65'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition ${
                        checked
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-slate-600 bg-slate-950 text-transparent'
                      }`}
                    >
                      <Check className="h-4 w-4 stroke-[3]" />
                    </span>
                    <div>
                      <span className="text-sm font-bold text-white">{sub}</span>
                      {isUsed && (
                        <span className="ml-2 inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Spilt
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={!canPick || selectedSubs.length === 0}
            onClick={() => onPickCategory(expandedGroup.category, selectedSubs)}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-[0.99] disabled:opacity-40"
          >
            {selectedSubs.length === 0
              ? 'Velg minst én underkategori'
              : selectedSubs.length === expandedGroup.subcategories.length
                ? `Start runde (alle ${selectedSubs.length})`
                : `Start runde (${selectedSubs.length} valgte)`}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {state.categoryChoices.map((group) => {
            const isUsed = isGroupUsed(group);
            return (
              <div
                key={group.category}
                className={`flex w-full items-center justify-between gap-2 rounded-2xl border p-2 transition ${
                  canPick
                    ? isUsed
                      ? 'border-slate-800 bg-slate-900/60'
                      : 'border-slate-700 bg-slate-900'
                    : isUsed
                      ? 'border-slate-800/60 bg-slate-900/35 opacity-60'
                      : 'border-slate-800/80 bg-slate-900/50 opacity-85'
                }`}
              >
                <button
                  type="button"
                  disabled={!canPick}
                  onClick={() => onPickCategory(group.category, null)}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-800/70 active:scale-[0.99] disabled:pointer-events-none"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isUsed
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-indigo-600/20 text-indigo-400'
                    }`}
                  >
                    {isUsed ? <Check className="h-5 w-5" /> : <Layers className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-white">
                        {group.category}
                      </span>
                      {isUsed && (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          Spilt
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {group.subcategories.join(' • ')}
                    </p>
                  </div>
                </button>

                {canPick && group.subcategories.length > 1 && (
                  <button
                    type="button"
                    onClick={() => openGroup(group)}
                    className="flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-700/80 bg-slate-800/70 px-3 py-2 text-[10px] font-semibold text-indigo-300 transition hover:border-indigo-500 hover:bg-slate-800 active:scale-95"
                    title="Velg underkategorier"
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
