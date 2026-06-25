import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { getAllVideos } from '@/db/videos-repo';
import type { LibraryVideo } from './types';

/** Loads the full, unfiltered library once (Settings folder list + hidden count). */
export function useAllVideos(): LibraryVideo[] {
  const db = useSQLiteContext();
  const [all, setAll] = useState<LibraryVideo[]>([]);
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((rows) => { if (!cancelled) setAll(rows); })
      .catch(() => { /* non-essential read; ignore */ });
    return () => { cancelled = true; };
  }, [db]);
  return all;
}
