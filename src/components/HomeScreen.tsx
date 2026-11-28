import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  History,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ActiveSessionInfo } from '../data/sessionStorage';
import {
  deleteSavedGroup,
  loadSavedGroups,
  type SavedGroup,
} from '../data/groupStorage';
import {
  clearHistory,
  deleteHistoryEntry,
  formatHistoryDate,
  formatHistoryEntryAsText,
  loadHistory,
  type QuizHistoryEntry,
} from '../data/historyStorage';

interface HomeScreenProps {
  totalQuestions: number;
  categoryCount: number;
  error: string | null;
  connecting: boolean;
  resumableSession: ActiveSessionInfo | null;
  onResume: () => void;
  onDismissResume: () => void;
  onHost: (name: string, fixedRoomCode?: string) => void;
  onJoin: (roomCode: string, name: string) => void;
}

const SAVED_NAMES_KEY = 'selskapsquiz_saved_names_v1';
const LAST_NAME_KEY = 'selskapsquiz_player_name';

function loadSavedNames(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_NAMES_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(parsed)
      ? parsed.filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
      : [];
    const last = localStorage.getItem(LAST_NAME_KEY)?.trim();
    if (last && !list.some((n) => n.toLowerCase() === last.toLowerCase())) {
      return [last, ...list];
    }
    return list;
  } catch {
    return [];
  }
}

function persistSavedNames(names: string[], activeName: string): void {
  try {
    localStorage.setItem(SAVED_NAMES_KEY, JSON.stringify(names));
    if (activeName) {
      localStorage.setItem(LAST_NAME_KEY, activeName);
    } else {
      localStorage.removeItem(LAST_NAME_KEY);
    }
  } catch {
    // ignore
  }
}

export function HomeScreen({
  totalQuestions,
  categoryCount,
  error,
  connecting,
  resumableSession,
  onResume,
  onDismissResume,
  onHost,
  onJoin,
}: HomeScreenProps) {
  const [mode, setMode] = useState<'join' | 'host'>('join');
  const [savedNames, setSavedNames] = useState<string[]>(() => loadSavedNames());
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(LAST_NAME_KEY) ?? loadSavedNames()[0] ?? '';
    } catch {
      return '';
    }
  });
  const [addingNewName, setAddingNewName] = useState(() => loadSavedNames().length === 0);
  const [roomCode, setRoomCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QuizHistoryEntry[]>(() => loadHistory());
  const [savedGroups, setSavedGroups] = useState<SavedGroup[]>(() => loadSavedGroups());
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomCode(room.toUpperCase().slice(0, 6));
      setMode('join');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const nextNames = [
      trimmedName,
      ...savedNames.filter((n) => n.toLowerCase() !== trimmedName.toLowerCase()),
    ];
    setSavedNames(nextNames);
    setAddingNewName(false);
    persistSavedNames(nextNames, trimmedName);

    if (mode === 'host') {
      onHost(trimmedName);
    } else if (roomCode.trim()) {
      onJoin(roomCode.trim().toUpperCase(), trimmedName);
    }
  };

  const handleDeleteSelectedName = () => {
    const nextNames = savedNames.filter(
      (n) => n.toLowerCase() !== name.trim().toLowerCase()
    );
    const nextActive = nextNames[0] ?? '';
    setSavedNames(nextNames);
    setName(nextActive);
    if (nextNames.length === 0) {
      setAddingNewName(true);
    }
    persistSavedNames(nextNames, nextActive);
  };

  const handleCopyEntry = async (entry: QuizHistoryEntry) => {
    try {
      await navigator.clipboard.writeText(formatHistoryEntryAsText(entry));
      setCopiedId(entry.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  if (showHistory) {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowHistory(false)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Tilbake
          </button>
          <h2 className="text-base font-extrabold text-white">Tidligere resultater</h2>
          {history.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
              className="text-xs font-semibold text-rose-400 hover:text-rose-300"
            >
              Tøm logg
            </button>
          ) : (
            <span className="w-12" />
          )}
        </div>

        {history.length === 0 ? (
          <div className="rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
            <History className="mx-auto mb-3 h-8 w-8 text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">
              Ingen lagrede resultater ennå
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Sluttresultatene lagres automatisk her når en quiz er ferdig.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {(() => {
              const groupNames = [
                ...new Set(
                  history
                    .map((e) => e.groupName)
                    .filter((n): n is string => Boolean(n))
                ),
              ];
              const filtered =
                selectedGroupFilter === 'ALL'
                  ? history
                  : history.filter((e) => e.groupName === selectedGroupFilter);

              const marathonMap = new Map<
                string,
                { name: string; wins: number; totalScore: number; games: number }
              >();
              if (selectedGroupFilter !== 'ALL') {
                for (const entry of filtered) {
                  entry.players.forEach((p, idx) => {
                    const key = p.name.trim().toLowerCase();
                    const prev = marathonMap.get(key) ?? {
                      name: p.name,
                      wins: 0,
                      totalScore: 0,
                      games: 0,
                    };
                    prev.wins += idx === 0 ? 1 : 0;
                    prev.totalScore += p.totalScore;
                    prev.games += 1;
                    marathonMap.set(key, prev);
                  });
                }
              }
              const marathonRows = [...marathonMap.values()].sort(
                (a, b) => b.wins - a.wins || b.totalScore - a.totalScore
              );

              return (
                <>
                  {groupNames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedGroupFilter('ALL')}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                          selectedGroupFilter === 'ALL'
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                        }`}
                      >
                        Alle
                      </button>
                      {groupNames.map((gName) => (
                        <button
                          key={gName}
                          type="button"
                          onClick={() => setSelectedGroupFilter(gName)}
                          className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                            selectedGroupFilter === gName
                              ? 'bg-indigo-600 text-white'
                              : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
                          }`}
                        >
                          {gName}
                        </button>
                      ))}
                    </div>
                  )}

                  {marathonRows.length > 0 && (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Maratontabell • {selectedGroupFilter} ({filtered.length} quizer)
                      </p>
                      <div className="space-y-1.5">
                        {marathonRows.map((row, idx) => (
                          <div
                            key={row.name}
                            className="flex items-center justify-between rounded-xl bg-slate-950/70 px-3 py-2 text-xs"
                          >
                            <span className="font-bold text-white">
                              {idx + 1}. {row.name}
                            </span>
                            <span className="text-slate-300">
                              <span className="font-extrabold text-amber-300">
                                {row.wins} {row.wins === 1 ? 'seier' : 'seire'}
                              </span>{' '}
                              • {row.totalScore} p
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {filtered.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-indigo-300">
                        {formatHistoryDate(entry.finishedAt)}
                      </p>
                      {entry.groupName && (
                        <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-200">
                          {entry.groupName}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {entry.categories.length > 0
                        ? entry.categories.join(' • ')
                        : 'Blandet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyEntry(entry)}
                      className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:text-white"
                      title="Kopier resultat"
                    >
                      {copiedId === entry.id ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistory(deleteHistoryEntry(entry.id))}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-500 hover:text-rose-400"
                      title="Slett"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {entry.players.map((p, idx) => (
                    <div
                      key={`${entry.id}-${idx}`}
                      className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-white">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`}{' '}
                        {p.name}
                      </span>
                      <span className="font-bold text-indigo-300">
                        {p.totalScore} p{' '}
                        <span className="font-normal text-slate-500">
                          ({(p.totalCorrectMs / 1000).toFixed(1)}s)
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
                </>
              );
            })()}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-between px-5 py-8">
      <div>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-600/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            SelskapsQuiz
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            <span className="text-slate-300">
              {totalQuestions} spørsmål i {categoryCount} kategorier.
            </span>
          </p>
        </div>

        {resumableSession && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-3.5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Pågående quiz funnet
              </p>
              <p className="truncate text-sm font-semibold text-white">
                Rom {resumableSession.roomCode} • {resumableSession.playerName}{' '}
                {resumableSession.role === 'host' ? '(Vert)' : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={connecting}
                onClick={onResume}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 active:scale-95 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Gjenoppta
              </button>
              <button
                type="button"
                onClick={onDismissResume}
                className="rounded-xl border border-slate-700 bg-slate-800/80 p-2 text-slate-400 hover:text-white"
                title="Avvis"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-900 p-1.5 border border-slate-800">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
              mode === 'join'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="h-4 w-4" />
            Bli med
          </button>
          <button
            type="button"
            onClick={() => setMode('host')}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition ${
              mode === 'host'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="h-4 w-4" />
            Start ny quiz
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'join' && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Romkode
              </label>
              <input
                type="text"
                inputMode="text"
                autoCapitalize="characters"
                maxLength={6}
                placeholder="F.eks. K7M2"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-center text-2xl font-bold tracking-[0.25em] text-white placeholder:text-base placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ditt navn
            </label>
            {savedNames.length > 0 && !addingNewName ? (
              <div className="flex items-center gap-2">
                <select
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    persistSavedNames(savedNames, e.target.value);
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-base font-semibold text-white focus:border-indigo-500 focus:outline-none"
                >
                  {savedNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setAddingNewName(true);
                    setName('');
                  }}
                  className="inline-flex h-[52px] shrink-0 items-center gap-1 rounded-2xl border border-slate-800 bg-slate-900 px-3 text-xs font-bold text-indigo-300 hover:bg-slate-800 hover:text-white"
                  title="Nytt navn"
                >
                  <Plus className="h-4 w-4" />
                  Ny
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedName}
                  className="inline-flex h-[52px] shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 px-3 text-slate-400 hover:bg-slate-800 hover:text-rose-400"
                  title="Slett valgt navn"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Hva heter du?"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="min-w-0 flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-lg text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  required
                />
                {savedNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewName(false);
                      setName(savedNames[0] ?? '');
                    }}
                    className="h-[52px] shrink-0 rounded-2xl border border-slate-800 bg-slate-900 px-3 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    Avbryt
                  </button>
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={connecting || !name.trim() || (mode === 'join' && !roomCode.trim())}
            className="w-full rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {connecting
              ? 'Kobler til...'
              : mode === 'host'
                ? 'Opprett quiz-rom'
                : 'Bli med i rommet'}
          </button>
        </form>

        {savedGroups.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Dine selskaper
            </p>
            {savedGroups.map((g) => {
              const others = g.memberNames.filter(
                (m) => m.toLowerCase() !== g.myPlayerName.toLowerCase()
              );
              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/90 p-3.5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-white">
                          {g.name}
                        </span>
                        <span className="rounded-md bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-indigo-300">
                          {g.roomCode}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        Deg: {g.myPlayerName}
                        {others.length > 0 ? ` • Med: ${others.join(', ')}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSavedGroups(deleteSavedGroup(g.id))}
                      className="rounded-lg p-1 text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                      title="Slett selskap"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => onJoin(g.roomCode, g.myPlayerName)}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white transition hover:bg-indigo-500 active:scale-95 disabled:opacity-50"
                    >
                      <Users className="h-3.5 w-3.5" />
                      Bli med
                    </button>
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => onHost(g.myPlayerName, g.roomCode)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start som vert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setHistory(loadHistory());
              setShowHistory(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <History className="h-4 w-4 text-indigo-400" />
            Tidligere resultater ({history.length})
          </button>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Tips: I modusen «Oppleser på rundgang» ser bare én spiller spørsmålet og
        leser det høyt – så slipper alle å stirre ned i mobilen.
      </p>
    </div>
  );
}
