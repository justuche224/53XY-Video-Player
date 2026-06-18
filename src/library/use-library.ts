// src/library/use-library.ts
import { usePermissions } from 'expo-media-library';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { scanVideos } from '@/media/media-scanner';
import { deleteVideosByIds, getAllVideos, upsertVideos } from '@/db/videos-repo';
import { groupByFolder, groupByName } from './group-videos';
import type { Group, LibraryVideo } from './types';

export interface LibraryState {
  status: 'loading' | 'ready' | 'denied' | 'error';
  refreshing: boolean;
  groups: Group[];
  error?: string;
}

const toMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Cache-first library: shows the last-known list from SQLite immediately, then
 * scans the device in the background and reconciles (adds newly-found videos,
 * removes deleted ones) without blocking the UI — like VLC/MX.
 */
export function useLibrary(mode: 'name' | 'folder'): LibraryState {
  const db = useSQLiteContext();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [error, setError] = useState<string | undefined>();

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
        // A background scan failure must not wipe the cached list.
        if (!cancelled) setError(toMessage(e));
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    }
    refresh();
    return () => {
      cancelled = true;
    };
  }, [permission, requestPermission, db]);

  const groups = useMemo(
    () => (mode === 'name' ? groupByName(videos) : groupByFolder(videos)),
    [videos, mode],
  );

  const status: LibraryState['status'] = error
    ? 'error'
    : permDenied && videos.length === 0
      ? 'denied'
      : loaded
        ? 'ready'
        : 'loading';

  return { status, refreshing, groups, error };
}
