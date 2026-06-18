import { useMemo } from 'react';

import { useFilterSettings } from './filter-settings';
import { applyFilters } from './filter-videos';
import { groupByFolder, groupByName } from './group-videos';
import { useLibraryData } from './library-provider';
import type { Group } from './types';

/**
 * Read-only grouped view over the shared {@link useLibraryData} cache. No DB
 * read of its own — group detail and the player's prev/next resolve from the
 * in-memory library that was already loaded at app start.
 */
export function useGroups(mode: 'name' | 'folder'): {
  groups: Group[];
  loading: boolean;
  reload: () => void;
} {
  const { videos, status, reload } = useLibraryData();
  const { filter } = useFilterSettings();

  const groups = useMemo(() => {
    const visible = applyFilters(videos, filter);
    return mode === 'name' ? groupByName(visible) : groupByFolder(visible);
  }, [videos, mode, filter]);

  return { groups, loading: status === 'loading', reload };
}
