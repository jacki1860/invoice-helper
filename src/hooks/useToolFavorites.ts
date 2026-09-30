import { useEffect, useState, useSyncExternalStore } from 'react';
import { createToolFavoritesStore } from '../features/tools/favorites';
import type { ToolId } from '../features/tools/catalog';

export function useToolFavorites(): {
  favorites: ToolId[];
  toggleFavorite: (id: ToolId) => void;
  notice: string;
} {
  const [store] = useState(() =>
    createToolFavoritesStore(() => (typeof window === 'undefined' ? null : window.localStorage)),
  );
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => store.handleStorageEvent(event);
    window.addEventListener('storage', handleStorage);
    // Close the interval between the initial read and installing the listener.
    // This only reads storage; visiting the site never creates a saved record.
    store.synchronize();
    return () => window.removeEventListener('storage', handleStorage);
  }, [store]);

  return { ...snapshot, toggleFavorite: store.toggleFavorite };
}
