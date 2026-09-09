import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { deleteVideosByIds, getAllVideos, upsertVideos } from '@/db/videos-repo';
import { deleteProgressByIds } from '@/db/progress-repo';
import { getManualGroupsMap } from '@/db/manual-groups-repo';
import { deletePreviewFramesByIds } from '@/db/preview-frames-repo';
import { scanVideos } from '@/media/media-scanner';
import { useMediaAccess } from '@/permissions/media-access-provider';
import { applyFilters } from './filter-videos';
import { useFilterSettings } from './filter-settings';
import { groupByFolder, groupByName } from './group-videos';
import type { Group, LibraryVideo } from './types';

export type LibraryStatus = 'loading' | 'ready' | 'denied' | 'error';

interface LibraryData {
  videos: LibraryVideo[];
  manualGroups: Map<string, string>;
  // Computed once here and shared by every consumer of `useGroups`, instead
  // of each mounted screen (Home, group detail, player) re-deriving the same
  // grouping from the full library independently — the player screen mounting
  // on top of an already-mounted group screen was paying for this twice on
  // every open.
  groupsByName: Group[];
  groupsByFolder: Group[];
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
export function LibraryProvider({
  children,
  autoRequest = true,
}: {
  children: ReactNode;
  autoRequest?: boolean;
}) {
  const db = useSQLiteContext();
  const { videoAccess, requestVideoAccess } = useMediaAccess();
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [token, setToken] = useState(0);

  const [manualGroups, setManualGroups] = useState<Map<string, string>>(new Map());
  const { filter } = useFilterSettings();

  const visible = useMemo(() => applyFilters(videos, filter), [videos, filter]);
  const groupsByName = useMemo(
    () => groupByName(visible, manualGroups),
    [visible, manualGroups],
  );
  const groupsByFolder = useMemo(
    () => groupByFolder(visible, manualGroups),
    [visible, manualGroups],
  );

  // 1) Show the cached library immediately — reading our own DB needs no permission.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllVideos(db), getManualGroupsMap(db)])
      .then(([all, mg]) => {
        if (cancelled) return;
        setVideos(all);
        setManualGroups(mg);
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
      if (videoAccess === 'unknown') return; // permission still resolving
      if (videoAccess !== 'granted') {
        // While the onboarding tour is pending it owns the timing of the
        // system dialog — firing it here would put it behind the carousel,
        // before the slide that explains why we need it.
        if (autoRequest && videoAccess === 'askable') await requestVideoAccess();
        else if (videoAccess === 'blocked') setPermDenied(true);
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
        if (removed.length) {
          await deleteVideosByIds(db, removed);
          await deleteProgressByIds(db, removed);
          await deletePreviewFramesByIds(db, removed);
          // manual_groups cascades on delete
        }
        const [all, mg] = await Promise.all([getAllVideos(db), getManualGroupsMap(db)]);
        if (cancelled) return;
        setVideos(all);
        setManualGroups(mg);
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
  }, [videoAccess, requestVideoAccess, autoRequest, db, token]);

  const reload = useCallback(() => setToken((t) => t + 1), []);

  const status: LibraryStatus = error
    ? 'error'
    : permDenied && videos.length === 0
      ? 'denied'
      : loaded
        ? 'ready'
        : 'loading';

  return (
    <LibraryContext.Provider
      value={{ videos, manualGroups, groupsByName, groupsByFolder, status, refreshing, error, reload }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryData(): LibraryData {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibraryData must be used within a LibraryProvider');
  return ctx;
}
