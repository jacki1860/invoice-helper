import { tools } from './catalog.ts';
import type { ToolId } from './catalog.ts';

export const TOOL_FAVORITES_STORAGE_KEY = 'invoice-helper:tool-favorites:v1';

export interface FavoritesStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export interface ToolFavoritesSnapshot {
  favorites: ToolId[];
  notice: string;
}

interface FavoritesStorageEvent {
  key: string | null;
  storageArea: FavoritesStorage | null;
}

const knownTools = new Set<string>(tools.map((tool) => tool.id));
const STORAGE_NOTICE = '本次收藏無法儲存，只在本頁暫存，重新整理後可能消失。';
const INVALID_NOTICE = '收藏資料格式無法讀取，已保留原資料；新的收藏只在本頁暫存。';
const SERVER_SNAPSHOT: ToolFavoritesSnapshot = { favorites: [], notice: '' };

type ReadResult =
  | { ok: true; storage: FavoritesStorage; favorites: ToolId[] }
  | { ok: false; notice: string };

export function parseToolFavorites(raw: string | null): ToolId[] | null {
  if (raw === null) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  if (
    Object.keys(record).length !== 2 ||
    record.version !== 1 ||
    !Array.isArray(record.favorites) ||
    !record.favorites.every((id) => typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id))
  ) {
    return null;
  }
  // Retired IDs and duplicates can be ignored without rewriting the stored text.
  return [...new Set(record.favorites.filter((id): id is ToolId => knownTools.has(id)))];
}

function applyChoices(favorites: ToolId[], choices: Map<ToolId, boolean>): ToolId[] {
  const merged = new Set(favorites);
  for (const [id, selected] of choices) {
    if (selected) merged.add(id);
    else merged.delete(id);
  }
  return [...merged];
}

export function createToolFavoritesStore(getStorage: () => FavoritesStorage | null) {
  const listeners = new Set<() => void>();
  // Keep only explicit, unsaved choices. Applying these to a fresh read avoids
  // copying a stale tab's unrelated favorites over another tab's changes.
  const pendingChoices = new Map<ToolId, boolean>();

  const read = (): ReadResult => {
    try {
      const storage = getStorage();
      if (!storage) return { ok: false, notice: STORAGE_NOTICE };
      const favorites = parseToolFavorites(storage.getItem(TOOL_FAVORITES_STORAGE_KEY));
      return favorites === null
        ? { ok: false, notice: INVALID_NOTICE }
        : { ok: true, storage, favorites };
    } catch {
      // Accessing localStorage itself and getItem can both throw SecurityError.
      return { ok: false, notice: STORAGE_NOTICE };
    }
  };

  const initial = read();
  let snapshot: ToolFavoritesSnapshot = initial.ok
    ? { favorites: initial.favorites, notice: '' }
    : { favorites: [], notice: initial.notice };

  const update = (favorites: ToolId[], notice: string) => {
    if (
      notice === snapshot.notice &&
      favorites.length === snapshot.favorites.length &&
      favorites.every((id, index) => id === snapshot.favorites[index])
    ) {
      return;
    }
    snapshot = { favorites, notice };
    for (const listener of listeners) listener();
  };

  const synchronize = () => {
    const latest = read();
    if (!latest.ok) {
      update(snapshot.favorites, latest.notice);
      return;
    }
    update(
      applyChoices(latest.favorites, pendingChoices),
      pendingChoices.size ? STORAGE_NOTICE : '',
    );
  };

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => SERVER_SNAPSHOT,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    synchronize,
    handleStorageEvent: (event: FavoritesStorageEvent) => {
      if (event.key !== TOOL_FAVORITES_STORAGE_KEY && event.key !== null) return;
      try {
        // A sessionStorage event must not alter local favorites. Read current
        // storage, not event.newValue, which may already be stale on delivery.
        const storage = getStorage();
        if (!storage || event.storageArea !== storage) return;
      } catch {
        update(snapshot.favorites, STORAGE_NOTICE);
        return;
      }
      synchronize();
    },
    toggleFavorite: (id: ToolId) => {
      if (!knownTools.has(id)) return;
      const selected = !snapshot.favorites.includes(id);
      pendingChoices.set(id, selected);
      const latest = read();
      const favorites = applyChoices(
        latest.ok ? latest.favorites : snapshot.favorites,
        pendingChoices,
      );
      if (!latest.ok) {
        update(favorites, latest.notice);
        return;
      }
      try {
        latest.storage.setItem(
          TOOL_FAVORITES_STORAGE_KEY,
          JSON.stringify({ version: 1, favorites }),
        );
        pendingChoices.clear();
        update(favorites, '');
      } catch {
        update(favorites, STORAGE_NOTICE);
      }
    },
  };
}
