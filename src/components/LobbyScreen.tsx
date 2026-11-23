import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Crown, Mic, Smartphone, Users } from 'lucide-react';
import type { GameSettings, PublicGameState } from '../types/quiz';

interface LobbyScreenProps {
  state: PublicGameState;
  isHost: boolean;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onStartGame: () => void;
}

export function LobbyScreen({
  state,
  isHost,
  onUpdateSettings,
  onStartGame,
}: LobbyScreenProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const joinUrl = `${window.location.origin}${window.location.pathname}?room=${state.roomCode}`;

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 220,
      margin: 2,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [joinUrl]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Romkode
        </p>
        <div className="mt-1 text-4xl font-black tracking-[0.25em] text-white">
          {state.roomCode}
        </div>

        {qrDataUrl && (
          <div className="mx-auto mt-4 inline-block rounded-2xl bg-white p-2.5 shadow">
            <img src={qrDataUrl} alt="QR-kode for å bli med" className="h-40 w-40" />
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Lenke kopiert!' : 'Kopier invitasjonslenke'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
            <Users className="h-4 w-4 text-indigo-400" />
            Spillere ({state.players.length})
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {state.players.map((p) => (
            <div
              key={p.id}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                p.connected
                  ? 'border-slate-700 bg-slate-800 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-500'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  p.connected ? 'bg-emerald-400' : 'bg-slate-600'
                }`}
              />
              {p.name}
              {p.isHost && <Crown className="h-3.5 w-3.5 text-amber-400" />}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Spilloppsett
        </h2>

        <div>
          <label className="mb-2 block text-xs text-slate-400">Sosial modus</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isHost}
              onClick={() => onUpdateSettings({ socialMode: 'quizmaster' })}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition ${
                state.settings.socialMode === 'quizmaster'
                  ? 'border-indigo-500 bg-indigo-500/15 text-white'
                  : 'border-slate-800 bg-slate-950/50 text-slate-400'
              }`}
            >
              <Mic className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-bold">Oppleser</span>
              <span className="text-[11px] leading-tight text-slate-400">
                Én leser høyt per runde
              </span>
            </button>
            <button
              type="button"
              disabled={!isHost}
              onClick={() => onUpdateSettings({ socialMode: 'simultaneous' })}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-3 text-left transition ${
                state.settings.socialMode === 'simultaneous'
                  ? 'border-indigo-500 bg-indigo-500/15 text-white'
                  : 'border-slate-800 bg-slate-950/50 text-slate-400'
              }`}
            >
              <Smartphone className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-bold">Alle samtidig</span>
              <span className="text-[11px] leading-tight text-slate-400">
                Alle ser spørsmålet likt
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="mb-1 block text-xs text-slate-400">Runder</label>
            <select
              disabled={!isHost}
              value={state.settings.roundsCount}
              onChange={(e) => onUpdateSettings({ roundsCount: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Spm / runde</label>
            <select
              disabled={!isHost}
              value={state.settings.questionsPerRound}
              onChange={(e) =>
                onUpdateSettings({ questionsPerRound: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {[2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">Tid (sek)</label>
            <select
              disabled={!isHost}
              value={state.settings.timeLimitSeconds}
              onChange={(e) =>
                onUpdateSettings({ timeLimitSeconds: Number(e.target.value) })
              }
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-white"
            >
              {[10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n}s
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isHost ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={onStartGame}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-slate-950 shadow-lg shadow-emerald-500/20 transition active:scale-[0.99]"
          >
            Start quizen!
          </button>
          {state.players.length < 2 && (
            <p className="text-center text-xs text-slate-400">
              Venter på flere spillere (du kan også starte alene for å teste).
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center text-sm text-slate-300">
          Venter på at verten skal starte quizen...
        </div>
      )}
    </div>
  );
}
