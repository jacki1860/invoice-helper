import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createToolFavoritesStore,
  parseToolFavorites,
  TOOL_FAVORITES_STORAGE_KEY,
} from '../src/features/tools/favorites.ts';
import type { FavoritesStorage } from '../src/features/tools/favorites.ts';
import type { ToolId } from '../src/features/tools/catalog.ts';

function encoded(favorites: string[]) {
  return JSON.stringify({ version: 1, favorites });
}

function memoryStorage(raw: string | null = null) {
  let value = raw;
  let readError: Error | null = null;
  let writeError: Error | null = null;
  const writes: { key: string; value: string }[] = [];
  const storage: FavoritesStorage = {
    getItem(key) {
      assert.equal(key, TOOL_FAVORITES_STORAGE_KEY);
      if (readError) throw readError;
      return value;
    },
    setItem(key, next) {
      if (writeError) throw writeError;
      writes.push({ key, value: next });
      value = next;
    },
  };
  return {
    storage,
    writes,
    raw: () => value,
    external: (next: string | null) => {
      value = next;
    },
    failReads: (error: Error | null) => {
      readError = error;
    },
    failWrites: (error: Error | null) => {
      writeError = error;
    },
  };
}

function changed(storage: FavoritesStorage, key: string | null = TOOL_FAVORITES_STORAGE_KEY) {
  return { key, storageArea: storage };
}

test('first visit and subscriptions read only; explicit star clicks save only versioned tool IDs', () => {
  const memory = memoryStorage();
  const store = createToolFavoritesStore(() => memory.storage);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });
  store.synchronize();
  assert.deepEqual(store.getSnapshot(), { favorites: [], notice: '' });
  assert.equal(memory.raw(), null);
  assert.equal(memory.writes.length, 0);
  assert.equal(notifications, 0);
  store.toggleFavorite('quote');
  assert.deepEqual(memory.writes, [{ key: TOOL_FAVORITES_STORAGE_KEY, value: encoded(['quote']) }]);
  assert.deepEqual(Object.keys(JSON.parse(memory.raw()!)).toSorted(), ['favorites', 'version']);
  assert.equal(notifications, 1);
  store.toggleFavorite('quote');
  assert.equal(memory.raw(), encoded([]));
  unsubscribe();
  store.toggleFavorite('tax');
  assert.equal(notifications, 2);
});

test('valid old records filter retired IDs and duplicates without rewriting on load', () => {
  const raw = encoded(['retired-tool', 'quote', 'quote', 'invoice']);
  const memory = memoryStorage(raw);
  const store = createToolFavoritesStore(() => memory.storage);
  assert.deepEqual(store.getSnapshot(), { favorites: ['quote', 'invoice'], notice: '' });
  store.synchronize();
  assert.equal(memory.raw(), raw);
  assert.equal(memory.writes.length, 0);
});

test('malformed JSON or schema is preserved while new choices stay in this page', () => {
  const malformed = [
    '{bad json',
    'null',
    '[]',
    '{}',
    JSON.stringify({ version: 2, favorites: ['invoice'] }),
    JSON.stringify({ version: 1, favorites: 'invoice' }),
    JSON.stringify({ version: 1, favorites: ['quote', 10] }),
    JSON.stringify({ version: 1, favorites: ['customer@example.com'] }),
    JSON.stringify({ version: 1, favorites: ['quote'], buyer: 'Private Customer' }),
  ];
  for (const raw of malformed) {
    const memory = memoryStorage(raw);
    const store = createToolFavoritesStore(() => memory.storage);
    assert.match(store.getSnapshot().notice, /保留原資料/);
    store.toggleFavorite('quote');
    store.toggleFavorite('tax');
    assert.deepEqual(store.getSnapshot().favorites, ['quote', 'tax']);
    assert.match(store.getSnapshot().notice, /只在本頁/);
    assert.equal(memory.raw(), raw);
    assert.equal(memory.writes.length, 0);
    assert.equal(parseToolFavorites(raw), null);
  }
});

test('SecurityError from the storage getter retains in-page choices without throwing', () => {
  const store = createToolFavoritesStore(() => {
    throw new DOMException('denied', 'SecurityError');
  });
  assert.match(store.getSnapshot().notice, /只在本頁/);
  store.toggleFavorite('quote');
  store.toggleFavorite('tax');
  store.toggleFavorite('quote');
  assert.deepEqual(store.getSnapshot().favorites, ['tax']);
  store.handleStorageEvent(changed(null as unknown as FavoritesStorage));
  assert.deepEqual(store.getSnapshot().favorites, ['tax']);
});

test('getItem failure after loading preserves the last visible favorites and new selections', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  memory.failReads(new DOMException('denied', 'SecurityError'));
  store.toggleFavorite('tax');
  store.synchronize();
  assert.deepEqual(store.getSnapshot().favorites, ['invoice', 'tax']);
  assert.match(store.getSnapshot().notice, /只在本頁/);
  assert.equal(memory.raw(), encoded(['invoice']));
  assert.equal(memory.writes.length, 0);
});

test('quota failures preserve storage and all in-page choices until a later explicit save succeeds', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  memory.failWrites(new DOMException('full', 'QuotaExceededError'));
  store.toggleFavorite('quote');
  store.toggleFavorite('tax');
  assert.deepEqual(store.getSnapshot().favorites, ['invoice', 'quote', 'tax']);
  assert.equal(memory.raw(), encoded(['invoice']));
  assert.match(store.getSnapshot().notice, /只在本頁/);
  memory.failWrites(null);
  store.synchronize();
  assert.equal(memory.writes.length, 0, 'storage recovery does not itself authorize a write');
  assert.match(store.getSnapshot().notice, /只在本頁/);
  store.toggleFavorite('calendar');
  assert.equal(memory.raw(), encoded(['invoice', 'quote', 'tax', 'calendar']));
  assert.equal(store.getSnapshot().notice, '');
});

test('a stale tab applies the clicked state to fresh storage without undoing other tab changes', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const stale = createToolFavoritesStore(() => memory.storage);
  memory.external(encoded(['tax']));
  stale.toggleFavorite('invoice');
  assert.equal(
    memory.raw(),
    encoded(['tax']),
    'clicked removal stays a removal even if already removed externally',
  );
  memory.external(encoded(['tax', 'calendar']));
  stale.toggleFavorite('quote');
  assert.equal(memory.raw(), encoded(['tax', 'calendar', 'quote']));
});

test('storage events sync current localStorage, including removals and clear, without a write', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  memory.external(encoded(['quote', 'calendar']));
  store.handleStorageEvent(changed(memory.storage));
  assert.deepEqual(store.getSnapshot().favorites, ['quote', 'calendar']);
  memory.external(null);
  store.handleStorageEvent(changed(memory.storage, null));
  assert.deepEqual(store.getSnapshot().favorites, []);
  assert.equal(store.getSnapshot().notice, '');
  assert.equal(memory.writes.length, 0);
});

test('unrelated keys, another storage area and obsolete event payloads cannot overwrite favorites', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const session = memoryStorage(encoded(['quote']));
  const store = createToolFavoritesStore(() => memory.storage);
  memory.external(encoded(['tax']));
  store.handleStorageEvent(changed(memory.storage, 'invoice-helper:receivables'));
  store.handleStorageEvent(changed(session.storage));
  store.handleStorageEvent({ key: TOOL_FAVORITES_STORAGE_KEY, storageArea: null });
  assert.deepEqual(store.getSnapshot().favorites, ['invoice']);
  const delayedEvent = { ...changed(memory.storage), newValue: encoded(['quote']) };
  store.handleStorageEvent(delayedEvent);
  assert.deepEqual(store.getSnapshot().favorites, ['tax']);
  assert.equal(memory.writes.length, 0);
});

test('unsaved local choices survive external changes and merge without resurrecting unrelated removed favorites', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  memory.failWrites(new DOMException('full', 'QuotaExceededError'));
  store.toggleFavorite('quote');
  memory.external(encoded(['tax']));
  store.handleStorageEvent(changed(memory.storage));
  assert.deepEqual(store.getSnapshot().favorites, ['tax', 'quote']);
  assert.match(store.getSnapshot().notice, /只在本頁/);
  assert.equal(memory.raw(), encoded(['tax']));
  memory.failWrites(null);
  store.toggleFavorite('calendar');
  assert.equal(memory.raw(), encoded(['tax', 'quote', 'calendar']));
  assert.equal(store.getSnapshot().notice, '');
});

test('an invalid external record is never overwritten; a later valid repair can sync and save local choices', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  const broken = '{broken';
  memory.external(broken);
  store.handleStorageEvent(changed(memory.storage));
  assert.deepEqual(store.getSnapshot().favorites, ['invoice']);
  assert.match(store.getSnapshot().notice, /保留原資料/);
  store.toggleFavorite('quote');
  assert.equal(memory.raw(), broken);
  assert.equal(memory.writes.length, 0);
  memory.external(encoded(['tax']));
  store.handleStorageEvent(changed(memory.storage));
  assert.deepEqual(store.getSnapshot().favorites, ['tax', 'quote']);
  assert.equal(memory.writes.length, 0);
  store.toggleFavorite('calendar');
  assert.equal(memory.raw(), encoded(['tax', 'quote', 'calendar']));
});

test('unknown runtime IDs are never written and the server snapshot stays empty and stable', () => {
  const memory = memoryStorage(encoded(['invoice']));
  const store = createToolFavoritesStore(() => memory.storage);
  store.toggleFavorite('private-client-data' as ToolId);
  assert.deepEqual(store.getSnapshot().favorites, ['invoice']);
  assert.equal(memory.writes.length, 0);
  assert.deepEqual(store.getServerSnapshot(), { favorites: [], notice: '' });
  assert.equal(store.getServerSnapshot(), store.getServerSnapshot());
});
