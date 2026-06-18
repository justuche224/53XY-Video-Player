import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';
import { EMPTY_FILTER, type LengthFilter } from './filter-videos';

const MIN_KEY = 'filter.minDurationMs';
const MAX_KEY = 'filter.maxDurationMs';

interface FilterSettings {
  filter: LengthFilter;
  setMin: (ms: number | null) => void;
  setMax: (ms: number | null) => void;
}

const FilterSettingsContext = createContext<FilterSettings | null>(null);

/** Parse a stored string into a positive ms number, or null if absent/invalid. */
function parseMs(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function FilterSettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [filter, setFilter] = useState<LengthFilter>(EMPTY_FILTER);

  // Load persisted thresholds once on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([getSetting(db, MIN_KEY), getSetting(db, MAX_KEY)])
      .then(([min, max]) => {
        if (!cancelled) setFilter({ minDurationMs: parseMs(min), maxDurationMs: parseMs(max) });
      })
      .catch(() => {
        // Leave EMPTY_FILTER on read failure — a broken setting must not blank the library.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const persist = (key: string, ms: number | null) =>
    void setSetting(db, key, ms == null ? '' : String(ms));

  const setMin = (ms: number | null) => {
    setFilter((f) => ({ ...f, minDurationMs: ms }));
    persist(MIN_KEY, ms);
  };
  const setMax = (ms: number | null) => {
    setFilter((f) => ({ ...f, maxDurationMs: ms }));
    persist(MAX_KEY, ms);
  };

  return (
    <FilterSettingsContext.Provider value={{ filter, setMin, setMax }}>
      {children}
    </FilterSettingsContext.Provider>
  );
}

export function useFilterSettings(): FilterSettings {
  const ctx = useContext(FilterSettingsContext);
  if (!ctx) throw new Error('useFilterSettings must be used within a FilterSettingsProvider');
  return ctx;
}
