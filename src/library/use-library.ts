import { useMemo } from 'react';

import { useFilterSettings } from './filter-settings';
import { applyFilters } from './filter-videos';
import { groupByFolder, groupByName } from './group-videos';
import { useLibraryData } from './library-provider';
import type { Group } from './types';

export interface LibraryState {
  status: 'loading' | 'ready' | 'denied' | 'error';
  refreshing: boolean;
  groups: Group[];
  error?: string;
}

/**
 * Thin consumer of the shared {@link useLibraryData} cache: applies the active
 * filter and groups by the requested mode. All load/scan/permission logic lives
 * in LibraryProvider so every screen shares one in-memory library.
 */
export function useLibrary(mode: 'name' | 'folder'): LibraryState {
  const { videos, manualGroups, status, refreshing, error } = useLibraryData();
  const { filter } = useFilterSettings();

  const groups = useMemo(() => {
    const visible = applyFilters(videos, filter);
    return mode === 'name' ? groupByName(visible, manualGroups) : groupByFolder(visible, manualGroups);
  }, [videos, manualGroups, mode, filter]);

  return { status, refreshing, groups, error };
}
