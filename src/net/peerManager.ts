import mqtt, { type MqttClient } from 'mqtt';
import type { ClientMessage, HostMessage } from '../types/quiz';

const BROKER_URL = 'wss://test.mosquitto.org:8081/mqtt';
const TOPIC_PREFIX = 'selskapsquiz/v1/';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 4): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

const PLAYER_ID_KEY = 'selskapsquiz_player_id';
const OPEN_TABS_KEY = 'selskapsquiz_open_tabs';
const TAB_ID_KEY = 'selskapsquiz_tab_id';
const TAB_TTL_MS = 10_000;

function generateUuid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p-${Math.random().toString(36).slice(2, 10)}`;
}

function readOpenTabs(): Record<string, { playerId: string; ts: number }> {
  try {
    const raw = localStorage.getItem(OPEN_TABS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { playerId: string; ts: number }>;
    const now = Date.now();
    const fresh: Record<string, { playerId: string; ts: number }> = {};
    for (const [tid, info] of Object.entries(parsed)) {
      if (info && typeof info.playerId === 'string' && now - info.ts < TAB_TTL_MS) {
        fresh[tid] = info;
      }
    }
    return fresh;
  } catch {
    return {};
  }
}

let tabHeartbeatStarted = false;

function registerTabPlayerId(tabId: string, playerId: string): void {
  const write = () => {
    try {
      const tabs = readOpenTabs();
      tabs[tabId] = { playerId, ts: Date.now() };
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
    } catch {
      // ignore
    }
  };
  write();
  if (!tabHeartbeatStarted) {
    tabHeartbeatStarted = true;
    window.setInterval(write, 3000);
    const unregister = () => {
      try {
        const tabs = readOpenTabs();
        delete tabs[tabId];
        localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
      } catch {
        // ignore
      }
    };
    window.addEventListener('pagehide', unregister);
    window.addEventListener('beforeunload', unregister);
  }
}

export function getOrCreatePlayerId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = generateUuid();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }

  // 1. If this tab already has a playerId (e.g. page refresh), keep it
  const tabPlayerId = sessionStorage.getItem(PLAYER_ID_KEY);
  if (tabPlayerId) {
    registerTabPlayerId(tabId, tabPlayerId);
    return tabPlayerId;
  }

  // 2. Otherwise check if the primary localStorage playerId is free (not held by another open tab)
  const storedId = localStorage.getItem(PLAYER_ID_KEY);
  const openTabs = readOpenTabs();
  const isStoredInUseByOtherTab =
    Boolean(storedId) &&
    Object.entries(openTabs).some(
      ([tid, info]) => tid !== tabId && info.playerId === storedId
    );

  let id: string;
  if (storedId && !isStoredInUseByOtherTab) {
    id = storedId;
  } else {
    id = generateUuid();
    if (!storedId) {
      localStorage.setItem(PLAYER_ID_KEY, id);
    }
  }

  sessionStorage.setItem(PLAYER_ID_KEY, id);
  registerTabPlayerId(tabId, id);
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
  publishStatus: (open: boolean, phase?: string) => void;
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
  const statusTopic = `${TOPIC_PREFIX}${roomCode}/status`;
  const knownPlayerIds = new Set<string>(
    (callbacks.initialKnownPlayerIds ?? []).filter((id) => id !== callbacks.hostPlayerId)
  );
  let readyFired = false;
  let destroyed = false;

  const releaseWakeLock = setupWakeLock();

  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId(`sq-host-${roomCode}`),
    clean: true,
    keepalive: 25,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
    will: {
      topic: statusTopic,
      payload: JSON.stringify({ open: false }),
      qos: 1,
      retain: true,
    },
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
        client.publish(
          statusTopic,
          JSON.stringify({ open: true, phase: 'lobby' }),
          { qos: 1, retain: true }
        );
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
    publishStatus(open, phase) {
      if (destroyed || !client.connected) return;
      client.publish(
        statusTopic,
        JSON.stringify({ open, phase }),
        { qos: 1, retain: true }
      );
    },
    destroy() {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisible);
      releaseWakeLock();
      if (client.connected) {
        client.publish(
          statusTopic,
          JSON.stringify({ open: false }),
          { qos: 1, retain: true },
          () => client.end(true)
        );
      } else {
        client.end(true);
      }
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
    keepalive: 25,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
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

  const joinRetryInterval = window.setInterval(() => {
    if (!joined && !destroyed && client.connected) {
      sendJoin();
    }
  }, 3000);

  const joinTimeout = window.setTimeout(() => {
    if (!joined && !destroyed) {
      destroyed = true;
      window.clearInterval(joinRetryInterval);
      client.end(true);
      params.onError(
        `Fant ikke rom "${cleanCode}", eller verten svarte ikke. Sjekk koden og prøv igjen.`
      );
      params.onDisconnected();
    }
  }, 12000);

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
        window.clearInterval(joinRetryInterval);
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
    if (!joined && /not authorized/i.test(err.message || '')) {
      destroyed = true;
      window.clearTimeout(joinTimeout);
      window.clearInterval(joinRetryInterval);
      client.end(true);
      params.onError('Tilkoblingen ble avvist av meldingsserveren. Prøv igjen.');
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
      window.clearInterval(joinRetryInterval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', triggerReconnect);
      releaseWakeLock();
      client.end(true);
    },
  };
}

export function watchRoomsStatus(
  roomCodes: string[],
  onStatus: (roomCode: string, open: boolean) => void
): () => void {
  const uniqueCodes = [...new Set(roomCodes.map((c) => c.trim().toUpperCase()).filter(Boolean))];
  if (uniqueCodes.length === 0) return () => {};

  let destroyed = false;
  const client: MqttClient = mqtt.connect(BROKER_URL, {
    clientId: makeClientId('sq-watch'),
    clean: true,
    keepalive: 25,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
  });

  client.on('connect', () => {
    if (destroyed) return;
    for (const code of uniqueCodes) {
      client.subscribe(`${TOPIC_PREFIX}${code}/status`, { qos: 1 });
    }
  });

  client.on('message', (topic, payload) => {
    if (destroyed) return;
    const match = topic.match(/^selskapsquiz\/v1\/([^/]+)\/status$/);
    if (!match) return;
    const code = match[1];
    try {
      const text = payload.toString().trim();
      if (!text) {
        onStatus(code, false);
        return;
      }
      const parsed = JSON.parse(text) as { open?: boolean };
      onStatus(code, Boolean(parsed.open));
    } catch {
      onStatus(code, false);
    }
  });

  return () => {
    destroyed = true;
    client.end(true);
  };
}
