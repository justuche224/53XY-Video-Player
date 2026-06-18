import { usePermissions } from 'expo-media-library';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { deleteVideosByIds, getAllVideos, upsertVideos } from '@/db/videos-repo';
import { scanVideos } from '@/media/media-scanner';
import type { LibraryVideo } from './types';

export type LibraryStatus = 'loading' | 'ready' | 'denied' | 'error';

interface LibraryData {
  videos: LibraryVideo[];
  status: LibraryStatus;
  refreshing: boolean;
  error?: string;
  reload: () => void;
}

const LibraryContext = createContext<LibraryData | null>(null);

const toMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Cache-first library, app-wide single source of truth: shows the last-known
 * list from SQLite immediately, then scans the device in the background and
 * reconciles. Mounted once at the app root so every screen shares one in-memory
 * copy instead of re-reading the whole videos table on each navigation.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [token, setToken] = useState(0);

  // 1) Show the cached library immediately — reading our own DB needs no permission.
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((all) => {
        if (cancelled) return;
        setVideos(all);
        setLoaded(true);
      })
      .catch((e) => {
        if (!cancelled) setError(toMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  // 2) Background scan + reconcile (does not block or clear the cached list).
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!permission) return; // permission still resolving
      if (!permission.granted) {
        if (permission.canAskAgain) await requestPermission();
        else setPermDenied(true);
        return;
      }
      setPermDenied(false);
      setRefreshing(true);
      try {
        const scanned = await scanVideos();
        const scannedIds = new Set(scanned.map((v) => v.id));
        const existing = await getAllVideos(db);
        const removed = existing.filter((v) => !scannedIds.has(v.id)).map((v) => v.id);
        await upsertVideos(db, scanned);
        if (removed.length) await deleteVideosByIds(db, removed);
        const all = await getAllVideos(db);
        if (cancelled) return;
        setVideos(all);
        setLoaded(true);
      } catch (e) {
        if (!cancelled) setError(toMessage(e));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, [permission, requestPermission, db, token]);

  const reload = useCallback(() => setToken((t) => t + 1), []);

  const status: LibraryStatus = error
    ? 'error'
    : permDenied && videos.length === 0
      ? 'denied'
      : loaded
        ? 'ready'
        : 'loading';

  return (
    <LibraryContext.Provider value={{ videos, status, refreshing, error, reload }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryData(): LibraryData {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibraryData must be used within a LibraryProvider');
  return ctx;
}
