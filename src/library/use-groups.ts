import { useLibraryData } from './library-provider';
import type { Group } from './types';

/**
 * Read-only grouped view over the shared {@link useLibraryData} cache. Groups
 * are computed once in `LibraryProvider` and shared by every consumer — no
 * per-mount recomputation here, so a screen mounting on top of another
 * (e.g. the player pushed over group detail) doesn't re-derive the same
 * grouping from the full library a second time.
 */
export function useGroups(mode: 'name' | 'folder'): {
  groups: Group[];
  loading: boolean;
  reload: () => void;
} {
  const { groupsByName, groupsByFolder, status, reload } = useLibraryData();
  return {
    groups: mode === 'name' ? groupsByName : groupsByFolder,
    loading: status === 'loading',
    reload,
  };
}
