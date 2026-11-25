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
  const existing = localStorage.getItem(key) ?? sessionStorage.getItem(key);
  if (existing) {
    localStorage.setItem(key, existing);
    return existing;
  }
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `p-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(key, id);
  return id;
}

function makeClientId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function setupWakeLock(): () => void {
  let wakeLock: WakeLockSentinel | null = null;
  let released = false;

  const request = () => {
    if (released || document.visibilityState !== 'visible') return;
    if ('wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((wl) => {
          wakeLock = wl;
        })
        .catch(() => {});
    }
  };

  request();
  const onVis = () => {
    if (document.visibilityState === 'visible') {
      request();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVis);
    wakeLock?.release().catch(() => {});
  };
}

export interface HostSession {
  roomCode: string;
  sendToPlayer: (playerId: string, msg: HostMessage) => void;
  broadcast: (buildMsg: (playerId: string) => HostMessage) => void;
  destroy: () => void;
}

export function createHostSession(callbacks: {
  hostPlayerId: string;
  roomCode?: string;
  initialKnownPlayerIds?: string[];
  onReady: (roomCode: string) => void;
  onMessage: (msg: ClientMessage, peerId: string) => void;
  onPlayerDisconnect: (playerId: string) => void;
  onError: (err: string) => void;
}): HostSession {
  const roomCode = callbacks.roomCode ?? generateRoomCode(4);
  const toHostTopic = `${TOPIC_PREFIX}${roomCode}/to-host`;
  const knownPlayerIds = new Set<string>(
    (callbacks.initialKnownPlayerIds ?? []).filter((id) => id !== callbacks.hostPlayerId)
  );
  let readyFired = false;
  let destroyed = false;

  const releaseWakeLock = setupWakeLock();

  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId(`sq-host-${roomCode}`),
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 8000,
  });

  const onVisible = () => {
    if (!destroyed && document.visibilityState === 'visible' && !client.connected) {
      client.reconnect();
    }
  };
  document.addEventListener('visibilitychange', onVisible);

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
      document.removeEventListener('visibilitychange', onVisible);
      releaseWakeLock();
      client.end(true);
    },
  };
}

export interface GuestSession {
  send: (msg: ClientMessage) => void;
  reconnect: () => void;
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
  let isConnected = false;
  let destroyed = false;

  const releaseWakeLock = setupWakeLock();

  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId(`sq-guest-${cleanCode}`),
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 8000,
  });

  const sendJoin = () => {
    if (destroyed || !client.connected) return;
    const joinMsg: ClientMessage = {
      type: 'join',
      playerId: params.playerId,
      name: params.playerName.trim(),
    };
    client.publish(toHostTopic, JSON.stringify(joinMsg), { qos: 1 });
  };

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
      sendJoin();
    });
  });

  client.on('message', (topic, payload) => {
    if (destroyed || topic !== myTopic) return;
    try {
      const msg = JSON.parse(payload.toString()) as HostMessage;
      if (!joined || !isConnected) {
        joined = true;
        isConnected = true;
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
      isConnected = false;
      params.onDisconnected();
    }
  });

  client.on('close', () => {
    if (!destroyed && joined && isConnected) {
      isConnected = false;
      params.onDisconnected();
    }
  });

  const triggerReconnect = () => {
    if (destroyed) return;
    if (client.connected) {
      sendJoin();
    } else {
      client.reconnect();
    }
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible') {
      triggerReconnect();
    }
  };

  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', triggerReconnect);

  client.on('error', (err) => {
    if (destroyed) return;
    if (!joined) {
      window.clearTimeout(joinTimeout);
      params.onError(err.message || 'Kunne ikke koble til rommet.');
      params.onDisconnected();
    }
  });

  return {
    send(msg) {
      if (!destroyed && client.connected) {
        client.publish(toHostTopic, JSON.stringify(msg), { qos: 1 });
      }
    },
    reconnect() {
      triggerReconnect();
    },
    destroy() {
      destroyed = true;
      window.clearTimeout(joinTimeout);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', triggerReconnect);
      releaseWakeLock();
      client.end(true);
    },
  };
}
