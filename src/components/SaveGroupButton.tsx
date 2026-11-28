import { useState } from 'react';
import { BookmarkCheck, BookmarkPlus } from 'lucide-react';
import {
  findSavedGroupByRoomCode,
  saveGroup,
  type SavedGroup,
} from '../data/groupStorage';
import type { PublicGameState } from '../types/quiz';

interface SaveGroupButtonProps {
  state: PublicGameState;
  myPlayerId: string;
}

export function SaveGroupButton({ state, myPlayerId }: SaveGroupButtonProps) {
  const [saved, setSaved] = useState<SavedGroup | undefined>(() =>
    findSavedGroupByRoomCode(state.roomCode)
  );
  const [editing, setEditing] = useState(false);
  const [groupName, setGroupName] = useState(() => saved?.name ?? '');

  const myName =
    state.players.find((p) => p.id === myPlayerId)?.name ??
    (() => {
      try {
        return localStorage.getItem('selskapsquiz_player_name') ?? 'Spiller';
      } catch {
        return 'Spiller';
      }
    })();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const result = saveGroup({
      name: groupName.trim() || `Selskap ${state.roomCode}`,
      roomCode: state.roomCode,
      myPlayerName: myName,
      memberNames: state.players.map((p) => p.name),
    });
    setSaved(result);
    setEditing(false);
  };

  if (saved && !editing) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
          <BookmarkCheck className="h-4 w-4 shrink-0" />
          Lagret som «{saved.name}» ({saved.roomCode})
        </span>
        <button
          type="button"
          onClick={() => {
            setGroupName(saved.name);
            setEditing(true);
          }}
          className="shrink-0 font-bold text-emerald-200 underline-offset-2 hover:underline"
        >
          Oppdater
        </button>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setGroupName(saved?.name ?? '');
          setEditing(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/80 py-3 text-xs font-bold text-slate-300 transition hover:bg-slate-800 hover:text-white"
      >
        <BookmarkPlus className="h-4 w-4 text-indigo-400" />
        Lagre dette selskapet til senere
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="space-y-2 rounded-2xl border border-indigo-500/30 bg-slate-900 p-3.5"
    >
      <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300">
        Navn på selskap
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          maxLength={30}
          placeholder="F.eks. Torsdagsgjengen"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          autoFocus
          className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm font-semibold text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500"
        >
          Lagre
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 rounded-xl border border-slate-700 px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-white"
        >
          Avbryt
        </button>
      </div>
      <p className="text-[11px] text-slate-400">
        Lagrer romkoden <span className="font-bold text-slate-200">{state.roomCode}</span>, ditt navn ({myName}) og deltakerne ({state.players.map((p) => p.name).join(', ')}).
      </p>
    </form>
  );
}
