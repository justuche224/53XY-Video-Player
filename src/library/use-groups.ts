import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { getAllVideos } from '@/db/videos-repo';
import { groupByFolder, groupByName } from './group-videos';
import type { Group, LibraryVideo } from './types';

export function useGroups(mode: 'name' | 'folder'): {
  groups: Group[];
  loading: boolean;
  reload: () => void;
} {
  const db = useSQLiteContext();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAllVideos(db)
      .then((all) => {
        if (!cancelled) setVideos(all);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, token]);

  const groups = useMemo(
    () => (mode === 'name' ? groupByName(videos) : groupByFolder(videos)),
    [videos, mode],
  );
  const reload = useCallback(() => setToken((t) => t + 1), []);
  return { groups, loading, reload };
}
