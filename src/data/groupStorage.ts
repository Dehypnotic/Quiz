export interface SavedGroup {
  id: string;
  name: string;
  roomCode: string;
  myPlayerName: string;
  memberNames: string[];
  savedAt: string;
}

const STORAGE_KEY = 'selskapsquiz_saved_groups_v1';
const MAX_GROUPS = 20;

export function loadSavedGroups(): SavedGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findSavedGroupByRoomCode(roomCode: string): SavedGroup | undefined {
  const code = roomCode.trim().toUpperCase();
  return loadSavedGroups().find((g) => g.roomCode.toUpperCase() === code);
}

export function saveGroup(input: Omit<SavedGroup, 'id' | 'savedAt'>): SavedGroup {
  const existing = loadSavedGroups();
  const code = input.roomCode.trim().toUpperCase();
  const cleanName = input.name.trim() || `Selskap ${code}`;
  const idx = existing.findIndex(
    (g) =>
      g.name.trim().toLowerCase() === cleanName.toLowerCase() ||
      g.roomCode.toUpperCase() === code
  );
  const entry: SavedGroup = {
    id: idx >= 0 ? existing[idx].id : `grp-${Date.now()}`,
    name: cleanName,
    roomCode: code,
    myPlayerName: input.myPlayerName.trim() || 'Spiller',
    memberNames: [...new Set(input.memberNames.map((n) => n.trim()).filter(Boolean))],
    savedAt: new Date().toISOString(),
  };
  const next =
    idx >= 0
      ? [
          entry,
          ...existing.filter(
            (g, i) =>
              i !== idx &&
              g.name.trim().toLowerCase() !== cleanName.toLowerCase() &&
              g.roomCode.toUpperCase() !== code
          ),
        ]
      : [entry, ...existing].slice(0, MAX_GROUPS);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
  return entry;
}

export function deleteSavedGroup(id: string): SavedGroup[] {
  const next = loadSavedGroups().filter((g) => g.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}
