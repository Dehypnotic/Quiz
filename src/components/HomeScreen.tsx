import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  History,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { ActiveSessionInfo } from '../data/sessionStorage';
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
  onHost: (name: string) => void;
  onJoin: (roomCode: string, name: string) => void;
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
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QuizHistoryEntry[]>(() => loadHistory());
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
    if (!name.trim()) return;
    if (mode === 'host') {
      onHost(name.trim());
    } else if (roomCode.trim()) {
      onJoin(roomCode.trim().toUpperCase(), name.trim());
    }
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
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-indigo-300">
                      {formatHistoryDate(entry.finishedAt)}
                    </p>
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
            <input
              type="text"
              maxLength={20}
              placeholder="Hva heter du?"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3.5 text-lg text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
              required
            />
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
