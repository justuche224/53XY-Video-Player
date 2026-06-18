import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';
import { EMPTY_FILTER, type LibraryFilter } from './filter-videos';

const MIN_KEY = 'filter.minDurationMs';
const MAX_KEY = 'filter.maxDurationMs';
const NAME_KEY = 'filter.namePatterns';
const FOLDERS_KEY = 'filter.ignoredFolders';

interface FilterSettings {
  filter: LibraryFilter;
  setMin: (ms: number | null) => void;
  setMax: (ms: number | null) => void;
  addNamePattern: (pattern: string) => void;
  removeNamePattern: (pattern: string) => void;
  toggleFolder: (path: string) => void;
}

const FilterSettingsContext = createContext<FilterSettings | null>(null);

/** Parse a stored string into a positive ms number, or null if absent/invalid. */
function parseMs(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse a stored JSON string into an array of strings; [] on absent/malformed. */
function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function FilterSettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);

  // Load all persisted filter settings once on mount.
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getSetting(db, MIN_KEY),
      getSetting(db, MAX_KEY),
      getSetting(db, NAME_KEY),
      getSetting(db, FOLDERS_KEY),
    ])
      .then(([min, max, names, folders]) => {
        if (!cancelled)
          setFilter({
            minDurationMs: parseMs(min),
            maxDurationMs: parseMs(max),
            namePatterns: parseStringArray(names),
            ignoredFolders: parseStringArray(folders),
          });
      })
      .catch(() => {
        // Leave EMPTY_FILTER on read failure — a broken setting must not blank the library.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const persistMs = (key: string, ms: number | null) =>
    void setSetting(db, key, ms == null ? '' : String(ms));
  const persistArr = (key: string, arr: string[]) => void setSetting(db, key, JSON.stringify(arr));

  const setMin = (ms: number | null) => {
    setFilter((f) => ({ ...f, minDurationMs: ms }));
    persistMs(MIN_KEY, ms);
  };
  const setMax = (ms: number | null) => {
    setFilter((f) => ({ ...f, maxDurationMs: ms }));
    persistMs(MAX_KEY, ms);
  };
  const addNamePattern = (pattern: string) => {
    const p = pattern.trim();
    if (p === '' || filter.namePatterns.includes(p)) return;
    const next = [...filter.namePatterns, p];
    setFilter((f) => ({ ...f, namePatterns: next }));
    persistArr(NAME_KEY, next);
  };
  const removeNamePattern = (pattern: string) => {
    const next = filter.namePatterns.filter((x) => x !== pattern);
    setFilter((f) => ({ ...f, namePatterns: next }));
    persistArr(NAME_KEY, next);
  };
  const toggleFolder = (path: string) => {
    const next = filter.ignoredFolders.includes(path)
      ? filter.ignoredFolders.filter((x) => x !== path)
      : [...filter.ignoredFolders, path];
    setFilter((f) => ({ ...f, ignoredFolders: next }));
    persistArr(FOLDERS_KEY, next);
  };

  return (
    <FilterSettingsContext.Provider
      value={{ filter, setMin, setMax, addNamePattern, removeNamePattern, toggleFolder }}>
      {children}
    </FilterSettingsContext.Provider>
  );
}

export function useFilterSettings(): FilterSettings {
  const ctx = useContext(FilterSettingsContext);
  if (!ctx) throw new Error('useFilterSettings must be used within a FilterSettingsProvider');
  return ctx;
}
