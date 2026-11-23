import { useEffect, useState } from 'react';
import { Sparkles, Users, Play } from 'lucide-react';

interface HomeScreenProps {
  totalQuestions: number;
  categoryCount: number;
  error: string | null;
  connecting: boolean;
  onHost: (name: string) => void;
  onJoin: (roomCode: string, name: string) => void;
}

export function HomeScreen({
  totalQuestions,
  categoryCount,
  error,
  connecting,
  onHost,
  onJoin,
}: HomeScreenProps) {
  const [mode, setMode] = useState<'join' | 'host'>('join');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');

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
            Sosial quiz på mobil – uten serverlagring.{' '}
            <span className="text-slate-300">
              {totalQuestions} spørsmål i {categoryCount} kategorier.
            </span>
          </p>
        </div>

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
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">
        Tips: I modusen «Oppleser på rundgang» ser bare én spiller spørsmålet og
        leser det høyt – så slipper alle å stirre ned i mobilen.
      </p>
    </div>
  );
}
