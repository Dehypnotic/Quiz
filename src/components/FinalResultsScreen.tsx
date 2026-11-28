import { useState } from 'react';
import { Check, Copy, Play, RotateCcw, Trophy } from 'lucide-react';
import { formatHistoryEntryAsText } from '../data/historyStorage';
import type { PublicGameState } from '../types/quiz';
import { SaveGroupButton } from './SaveGroupButton';
import { TransferHostCard } from './TransferHostCard';

interface FinalResultsScreenProps {
  state: PublicGameState;
  myPlayerId: string;
  isHost: boolean;
  onStartNewGame: () => void;
  onRestart: () => void;
  onTransferHost: (targetPlayerId: string) => void;
}

export function FinalResultsScreen({
  state,
  myPlayerId,
  isHost,
  onStartNewGame,
  onRestart,
  onTransferHost,
}: FinalResultsScreenProps) {
  const [copied, setCopied] = useState(false);

  const ranked = [...state.players].sort(
    (a, b) => b.totalScore - a.totalScore || a.totalCorrectMs - b.totalCorrectMs
  );
  const winner = ranked[0];
  const hasScoreTie =
    ranked.length > 1 && ranked[0].totalScore === ranked[1].totalScore;

  const handleCopy = async () => {
    const text = formatHistoryEntryAsText({
      id: `${state.roomCode}-${state.finishedAt ?? Date.now()}`,
      finishedAt: new Date(state.finishedAt ?? Date.now()).toISOString(),
      roomCode: state.roomCode,
      roundsCount: state.settings.roundsCount,
      categories: state.usedCategories,
      players: ranked.map((p) => ({
        name: p.name,
        totalScore: p.totalScore,
        totalCorrectMs: p.totalCorrectMs,
      })),
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

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
          {hasScoreTie && winner
            ? ` • Raskest svartid (${(winner.totalCorrectMs / 1000).toFixed(1)}s)`
            : ''}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Endelig resultatliste
          </h3>
          <span className="text-[11px] text-emerald-400">Lagret i logg ✓</span>
        </div>
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
              <div className="text-right">
                <span className="text-base font-extrabold text-indigo-300">
                  {p.totalScore} p
                </span>
                <span className="ml-1.5 text-xs text-slate-500">
                  ({(p.totalCorrectMs / 1000).toFixed(1)}s)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 py-3.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800 active:scale-[0.99]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-emerald-400" />
            Kopiert til utklippstavlen!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Kopier resultat til chat / SMS
          </>
        )}
      </button>

      <SaveGroupButton state={state} myPlayerId={myPlayerId} />

      {isHost ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={onStartNewGame}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-slate-950 shadow-lg transition active:scale-[0.99]"
          >
            <Play className="h-5 w-5" />
            Start ny konkurranse nå
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 py-3.5 text-sm font-bold text-slate-200 transition hover:bg-slate-800 active:scale-[0.99]"
          >
            <RotateCcw className="h-4 w-4" />
            Tilbake til lobby (endre oppsett)
          </button>
          <TransferHostCard
            players={state.players}
            onTransferHost={onTransferHost}
          />
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400">
          Venter på at verten starter en ny konkurranse...
        </p>
      )}
    </div>
  );
}
