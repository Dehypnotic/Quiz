import { useState } from 'react';
import { ArrowRightLeft, Crown } from 'lucide-react';
import type { Player } from '../types/quiz';

interface TransferHostCardProps {
  players: Player[];
  onTransferHost: (targetPlayerId: string) => void;
}

export function TransferHostCard({
  players,
  onTransferHost,
}: TransferHostCardProps) {
  const [open, setOpen] = useState(false);
  const candidates = players.filter((p) => !p.isHost && p.connected);

  if (candidates.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-300 hover:text-white"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-amber-400" />
          Overfør vertskap til en annen spiller
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-300">
              <Crown className="h-3.5 w-3.5" />
              Velg ny vert
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              Avbryt
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {candidates.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onTransferHost(p.id);
                }}
                className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 active:scale-95"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
