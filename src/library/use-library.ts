// src/library/use-library.ts
import { usePermissions } from 'expo-media-library';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';

import { scanVideos } from '@/media/media-scanner';
import { getAllVideos, upsertVideos } from '@/db/videos-repo';
import { groupByFolder, groupByName } from './group-videos';
import type { Group, LibraryVideo } from './types';

export interface LibraryState {
  status: 'idle' | 'loading' | 'denied' | 'ready' | 'error';
  groups: Group[];
  error?: string;
}

export function useLibrary(mode: 'name' | 'folder'): LibraryState {
  const db = useSQLiteContext();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [status, setStatus] = useState<LibraryState['status']>('idle');
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!permission) return; // still resolving
      if (!permission.granted) {
        if (permission.canAskAgain) {
          await requestPermission();
          return;
        }
        setStatus('denied');
        return;
      }
      setStatus('loading');
      try {
        const scanned = await scanVideos();
        await upsertVideos(db, scanned);
        const all = await getAllVideos(db);
        if (cancelled) return;
        setVideos(all);
        setStatus('ready');
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [permission, requestPermission, db]);

  const groups = useMemo(
    () => (mode === 'name' ? groupByName(videos) : groupByFolder(videos)),
    [videos, mode],
  );

  return { status, groups, error };
}
