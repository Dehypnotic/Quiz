import mqtt, { type MqttClient } from 'mqtt';
import type { ClientMessage, HostMessage } from '../types/quiz';

const BROKER_URL = 'wss://broker.emqx.io:8084/mqtt';
const TOPIC_PREFIX = 'selskapsquiz/v1/';
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

function makeClientId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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
  const toHostTopic = `${TOPIC_PREFIX}${roomCode}/to-host`;
  const knownPlayerIds = new Set<string>();
  let readyFired = false;
  let destroyed = false;

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

  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId(`sq-host-${roomCode}`),
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
  });

  client.on('connect', () => {
    if (destroyed) return;
    client.subscribe(toHostTopic, { qos: 1 }, (err) => {
      if (err) {
        callbacks.onError('Kunne ikke abonnere på rom-kanal.');
        return;
      }
      if (!readyFired) {
        readyFired = true;
        callbacks.onReady(roomCode);
      }
    });
  });

  client.on('message', (topic, payload) => {
    if (destroyed || topic !== toHostTopic) return;
    try {
      const msg = JSON.parse(payload.toString()) as ClientMessage;
      if (msg && typeof msg === 'object' && 'playerId' in msg) {
        if (msg.playerId !== callbacks.hostPlayerId) {
          knownPlayerIds.add(msg.playerId);
        }
        callbacks.onMessage(msg, msg.playerId);
      }
    } catch {
      // Ignore malformed payloads
    }
  });

  client.on('error', (err) => {
    if (!destroyed) {
      callbacks.onError(err.message || 'Tilkoblingsfeil hos verten');
    }
  });

  return {
    roomCode,
    sendToPlayer(playerId, msg) {
      if (destroyed || playerId === callbacks.hostPlayerId) return;
      client.publish(
        `${TOPIC_PREFIX}${roomCode}/to-guest/${playerId}`,
        JSON.stringify(msg),
        { qos: 1 }
      );
    },
    broadcast(buildMsg) {
      if (destroyed) return;
      for (const playerId of knownPlayerIds) {
        client.publish(
          `${TOPIC_PREFIX}${roomCode}/to-guest/${playerId}`,
          JSON.stringify(buildMsg(playerId)),
          { qos: 1 }
        );
      }
    },
    destroy() {
      destroyed = true;
      wakeLock?.release().catch(() => {});
      client.end(true);
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
  const toHostTopic = `${TOPIC_PREFIX}${cleanCode}/to-host`;
  const myTopic = `${TOPIC_PREFIX}${cleanCode}/to-guest/${params.playerId}`;
  let joined = false;
  let destroyed = false;

  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId(`sq-guest-${cleanCode}`),
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 8000,
  });

  const joinTimeout = window.setTimeout(() => {
    if (!joined && !destroyed) {
      destroyed = true;
      client.end(true);
      params.onError(
        `Fant ikke rom "${cleanCode}", eller verten svarte ikke. Sjekk koden og prøv igjen.`
      );
      params.onDisconnected();
    }
  }, 8000);

  client.on('connect', () => {
    if (destroyed) return;
    client.subscribe(myTopic, { qos: 1 }, (err) => {
      if (err) {
        window.clearTimeout(joinTimeout);
        params.onError('Kunne ikke lytte til rommet.');
        params.onDisconnected();
        return;
      }

      const joinMsg: ClientMessage = {
        type: 'join',
        playerId: params.playerId,
        name: params.playerName.trim(),
      };
      client.publish(toHostTopic, JSON.stringify(joinMsg), { qos: 1 });
    });
  });

  client.on('message', (topic, payload) => {
    if (destroyed || topic !== myTopic) return;
    try {
      const msg = JSON.parse(payload.toString()) as HostMessage;
      if (!joined) {
        joined = true;
        window.clearTimeout(joinTimeout);
        params.onConnected();
      }
      params.onMessage(msg);
    } catch {
      // Ignore malformed payloads
    }
  });

  client.on('offline', () => {
    if (!destroyed && joined) {
      params.onDisconnected();
    }
  });

  client.on('error', (err) => {
    if (destroyed) return;
    window.clearTimeout(joinTimeout);
    params.onError(err.message || 'Kunne ikke koble til rommet.');
    params.onDisconnected();
  });

  return {
    send(msg) {
      if (!destroyed && client.connected) {
        client.publish(toHostTopic, JSON.stringify(msg), { qos: 1 });
      }
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(joinTimeout);
      client.end(true);
    },
  };
}
