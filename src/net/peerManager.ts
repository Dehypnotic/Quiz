import Peer, { type DataConnection } from 'peerjs';
import type { ClientMessage, HostMessage } from '../types/quiz';

const PEER_PREFIX = 'selskapsquiz-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function getOrCreatePlayerId(): string {
  const key = 'selskapsquiz_player_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p-${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(key, id);
  return id;
}

export interface HostSession {
  roomCode: string;
  sendToPlayer: (playerId: string, msg: HostMessage) => void;
  broadcast: (buildMsg: (playerId: string) => HostMessage) => void;
  destroy: () => void;
}

export function createHostSession(callbacks: {
  hostPlayerId: string;
  onReady: (roomCode: string) => void;
  onMessage: (msg: ClientMessage, peerId: string) => void;
  onPlayerDisconnect: (playerId: string) => void;
  onError: (err: string) => void;
}): HostSession {
  const roomCode = generateRoomCode(4);
  const peer = new Peer(`${PEER_PREFIX}${roomCode}`);
  const peerToPlayer = new Map<string, string>();
  const playerToConn = new Map<string, DataConnection>();

  let wakeLock: WakeLockSentinel | null = null;
  if ('wakeLock' in navigator) {
    navigator.wakeLock
      .request('screen')
      .then((wl) => {
        wakeLock = wl;
      })
      .catch(() => {
        // Ignore if battery saver / unsupported
      });
  }

  peer.on('open', () => {
    callbacks.onReady(roomCode);
  });

  peer.on('connection', (conn) => {
    conn.on('data', (raw) => {
      const msg = raw as ClientMessage;
      if (msg && typeof msg === 'object' && 'playerId' in msg) {
        peerToPlayer.set(conn.peer, msg.playerId);
        playerToConn.set(msg.playerId, conn);
        callbacks.onMessage(msg, conn.peer);
      }
    });

    conn.on('close', () => {
      const playerId = peerToPlayer.get(conn.peer);
      if (playerId) {
        if (playerToConn.get(playerId) === conn) {
          playerToConn.delete(playerId);
          callbacks.onPlayerDisconnect(playerId);
        }
        peerToPlayer.delete(conn.peer);
      }
    });
  });

  peer.on('error', (err) => {
    callbacks.onError(err.message || 'Tilkoblingsfeil hos verten');
  });

  return {
    roomCode,
    sendToPlayer(playerId, msg) {
      if (playerId === callbacks.hostPlayerId) return;
      const conn = playerToConn.get(playerId);
      if (conn && conn.open) {
        conn.send(msg);
      }
    },
    broadcast(buildMsg) {
      for (const [playerId, conn] of playerToConn.entries()) {
        if (conn.open) {
          conn.send(buildMsg(playerId));
        }
      }
    },
    destroy() {
      wakeLock?.release().catch(() => {});
      peer.destroy();
    },
  };
}

export interface GuestSession {
  send: (msg: ClientMessage) => void;
  destroy: () => void;
}

export function createGuestSession(params: {
  roomCode: string;
  playerId: string;
  playerName: string;
  onConnected: () => void;
  onMessage: (msg: HostMessage) => void;
  onDisconnected: () => void;
  onError: (err: string) => void;
}): GuestSession {
  const cleanCode = params.roomCode.trim().toUpperCase();
  const peer = new Peer();
  let conn: DataConnection | null = null;
  let opened = false;

  peer.on('open', () => {
    conn = peer.connect(`${PEER_PREFIX}${cleanCode}`, { reliable: true });

    conn.on('open', () => {
      opened = true;
      conn?.send({
        type: 'join',
        playerId: params.playerId,
        name: params.playerName.trim(),
      } satisfies ClientMessage);
      params.onConnected();
    });

    conn.on('data', (raw) => {
      params.onMessage(raw as HostMessage);
    });

    conn.on('close', () => {
      params.onDisconnected();
    });

    conn.on('error', () => {
      params.onError('Mistet forbindelsen til verten.');
    });
  });

  peer.on('error', (err) => {
    if (!opened) {
      params.onError(
        err.type === 'peer-unavailable'
          ? `Fant ikke rom "${cleanCode}". Sjekk koden og prøv igjen.`
          : err.message || 'Kunne ikke koble til rommet.'
      );
    } else {
      params.onError(err.message || 'Nettverksfeil');
    }
  });

  return {
    send(msg) {
      if (conn && conn.open) {
        conn.send(msg);
      }
    },
    destroy() {
      peer.destroy();
    },
  };
}
