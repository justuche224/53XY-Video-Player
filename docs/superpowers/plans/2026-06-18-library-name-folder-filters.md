# Library Name-Pattern & Folder Ignore Filters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two persistent "ignore" rules — by filename pattern (substring or glob) and by folder — to the library, configured in Settings alongside the existing length filter.

**Architecture:** Extends the merged length-filter machinery. The filter object grows from `{min,max}` to a `LibraryFilter` carrying `namePatterns` + `ignoredFolders`. Pure matchers (`matchesNamePattern`, `applyNameFilter`, `applyFolderFilter`) compose into a single `applyFilters` that replaces `applyLengthFilter` in `useLibrary`/`useGroups`. The `FilterSettingsProvider` persists the two new keys as JSON arrays and exposes add/remove/toggle mutators; the Settings screen gains a name-pattern list and a folder-toggle list.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, TypeScript, Jest (jest-expo), Material You theme tokens (`useTheme`).

## Global Constraints

- **Expo SDK 56 / RN 0.85.** Per `AGENTS.md`, read https://docs.expo.dev/versions/v56.0.0/ before writing any SDK code; verify thin docs against `node_modules/<pkg>/build/types/*.d.ts`.
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Package manager is `bun`.** Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **JS-only feature — no native module touched.** Fast Refresh applies; no `run:android` rebuild.
- **Android-only.**
- **Pure logic is Jest-tested; UI/glue (context, hook wiring, screens, components) is device-verified by the user.** For UI/glue tasks the agent gate is `npx tsc --noEmit` + `npm test` clean + a manual checklist.
- Tests live in `__tests__/` dirs next to the code.
- **Name match semantics:** case-insensitive; glob (anchored full-match, `*`→`.*`, `?`→`.`) when the pattern contains `*` or `?`, else substring "contains"; a blank/whitespace pattern never matches. Match targets the **filename including extension**.
- **A video is shown only if** it passes length AND matches no name pattern AND is not in an ignored folder. Empty filter = pass-through returning the same array reference.

---

### Task 1: Extend the filter model (`LengthFilter` → `LibraryFilter`)

**Files:**
- Modify: `src/library/filter-videos.ts`
- Modify: `src/library/filter-settings.tsx`

**Interfaces:**
- Produces: `interface LibraryFilter { minDurationMs: number | null; maxDurationMs: number | null; namePatterns: string[]; ignoredFolders: string[] }`; updated `EMPTY_FILTER: LibraryFilter`; `applyLengthFilter(videos, filter: LibraryFilter)`.
- Consumes: nothing new.

**Note:** Pure-type migration + context retype. The existing 92 tests and tsc must stay green. `applyLengthFilter` still reads only min/max. `filter-settings.tsx` keeps loading only min/max for now (arrays default to `[]`); Task 5 adds real array loading.

- [ ] **Step 1: Rename + extend the interface and `EMPTY_FILTER` in `filter-videos.ts`**

Replace lines 3–10 (the `LengthFilter` interface and `EMPTY_FILTER`) with:

```ts
export interface LibraryFilter {
  /** Hide videos strictly shorter than this many ms. null = no minimum. */
  minDurationMs: number | null;
  /** Hide videos strictly longer than this many ms. null = no maximum. */
  maxDurationMs: number | null;
  /** Case-insensitive substring-or-glob patterns; a video matching ANY is hidden. */
  namePatterns: string[];
  /** Folder paths (LibraryVideo.folder) whose videos are hidden. */
  ignoredFolders: string[];
}

export const EMPTY_FILTER: LibraryFilter = {
  minDurationMs: null,
  maxDurationMs: null,
  namePatterns: [],
  ignoredFolders: [],
};
```

- [ ] **Step 2: Widen `applyLengthFilter`'s parameter type**

Change its signature line (currently `export function applyLengthFilter(videos: LibraryVideo[], filter: LengthFilter): LibraryVideo[] {`) to:

```ts
export function applyLengthFilter(videos: LibraryVideo[], filter: LibraryFilter): LibraryVideo[] {
```

Leave the function body unchanged (it destructures only `minDurationMs`/`maxDurationMs`).

- [ ] **Step 3: Update `filter-settings.tsx` references**

- Change the import (line 5) to: `import { EMPTY_FILTER, type LibraryFilter } from './filter-videos';`
- Change the context field (line 11) to: `filter: LibraryFilter;`
- Change the state (line 27) to: `const [filter, setFilter] = useState<LibraryFilter>(EMPTY_FILTER);`
- Change the load `setFilter` call (line 34) to include empty arrays so it satisfies `LibraryFilter`:

```ts
        if (!cancelled)
          setFilter({
            minDurationMs: parseMs(min),
            maxDurationMs: parseMs(max),
            namePatterns: [],
            ignoredFolders: [],
          });
```

(`setMin`/`setMax` spread `...f`, so the arrays are preserved across length edits.)

- [ ] **Step 4: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; 92 tests pass (rename touched no behavior).

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-videos.ts src/library/filter-settings.tsx
git commit -m "refactor(library): extend filter model to LibraryFilter (name + folder fields)"
```

---

### Task 2: `matchesNamePattern` (pure)

**Files:**
- Modify: `src/library/filter-videos.ts`
- Test: `src/library/__tests__/match-name.test.ts`

**Interfaces:**
- Produces: `function matchesNamePattern(filename: string, pattern: string): boolean`.

- [ ] **Step 1: Write the failing test**

Create `src/library/__tests__/match-name.test.ts`:

```ts
import { matchesNamePattern } from '../filter-videos';

describe('matchesNamePattern', () => {
  it('substring match is case-insensitive', () => {
    expect(matchesNamePattern('My.Trailer.mp4', 'trailer')).toBe(true);
    expect(matchesNamePattern('TRAILER.mp4', 'trailer')).toBe(true);
    expect(matchesNamePattern('movie.mp4', 'trailer')).toBe(false);
  });

  it('glob with * matches prefix/suffix, anchored full-string', () => {
    expect(matchesNamePattern('VID_001.mp4', 'VID_*')).toBe(true);
    expect(matchesNamePattern('vid_001.mp4', 'VID_*')).toBe(true); // case-insensitive
    expect(matchesNamePattern('my_VID_001.mp4', 'VID_*')).toBe(false); // anchored
    expect(matchesNamePattern('movie.mkv', '*.mkv')).toBe(true);
    expect(matchesNamePattern('movie.mp4', '*.mkv')).toBe(false);
  });

  it('glob with ? matches exactly one character', () => {
    expect(matchesNamePattern('AQ12.mp4', 'AQ??.mp4')).toBe(true);
    expect(matchesNamePattern('AQ123.mp4', 'AQ??.mp4')).toBe(false);
  });

  it('treats regex metacharacters in the literal part literally', () => {
    expect(matchesNamePattern('a.bcd.mp4', 'a.b*')).toBe(true);
    expect(matchesNamePattern('axbcd.mp4', 'a.b*')).toBe(false); // '.' is literal, not "any char"
  });

  it('a blank/whitespace pattern never matches', () => {
    expect(matchesNamePattern('movie.mp4', '')).toBe(false);
    expect(matchesNamePattern('movie.mp4', '   ')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- match-name`
Expected: FAIL — `matchesNamePattern is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/library/filter-videos.ts`:

```ts
/** Translate a glob (with * and ?) into an anchored, case-insensitive RegExp. */
function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&'); // escape regex metachars (not * or ?)
  const translated = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${translated}$`, 'i');
}

/**
 * Case-insensitive. If the (trimmed) pattern contains * or ?, it is a glob
 * matched against the whole filename; otherwise it is a substring "contains".
 * A blank/whitespace pattern never matches (no-op safety).
 */
export function matchesNamePattern(filename: string, pattern: string): boolean {
  const p = pattern.trim();
  if (p === '') return false;
  if (p.includes('*') || p.includes('?')) return globToRegExp(p).test(filename);
  return filename.toLowerCase().includes(p.toLowerCase());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- match-name`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-videos.ts src/library/__tests__/match-name.test.ts
git commit -m "feat(library): matchesNamePattern (substring or anchored glob, case-insensitive)"
```

---

### Task 3: `applyNameFilter`, `applyFolderFilter`, `applyFilters` (pure)

**Files:**
- Modify: `src/library/filter-videos.ts`
- Test: `src/library/__tests__/apply-filters.test.ts`

**Interfaces:**
- Consumes: `matchesNamePattern` (Task 2); `applyLengthFilter`, `LibraryFilter`, `EMPTY_FILTER` (Task 1).
- Produces:
  - `function applyNameFilter(videos: LibraryVideo[], patterns: string[]): LibraryVideo[]`
  - `function applyFolderFilter(videos: LibraryVideo[], ignoredFolders: string[]): LibraryVideo[]`
  - `function applyFilters(videos: LibraryVideo[], filter: LibraryFilter): LibraryVideo[]`

- [ ] **Step 1: Write the failing test**

Create `src/library/__tests__/apply-filters.test.ts`:

```ts
import { applyFilters, applyFolderFilter, applyNameFilter, EMPTY_FILTER } from '../filter-videos';
import type { LibraryVideo } from '../types';

const v = (id: string, filename: string, folder: string, durationMs: number | null = 60_000): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename,
  durationMs,
  width: null,
  height: null,
  folder,
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const ids = (vs: LibraryVideo[]) => vs.map((x) => x.id);

const vids = [
  v('a', 'trailer.mp4', '/DCIM/Camera'),
  v('b', 'movie.mkv', '/Movies'),
  v('c', 'VID_001.mp4', '/WhatsApp'),
  v('d', 'show.mp4', '/Movies'),
];

describe('applyNameFilter', () => {
  it('hides videos matching ANY pattern', () => {
    expect(ids(applyNameFilter(vids, ['trailer', 'VID_*']))).toEqual(['b', 'd']);
  });
  it('empty patterns is a pass-through (same ref)', () => {
    expect(applyNameFilter(vids, [])).toBe(vids);
  });
});

describe('applyFolderFilter', () => {
  it('hides videos in an ignored folder', () => {
    expect(ids(applyFolderFilter(vids, ['/Movies']))).toEqual(['a', 'c']);
  });
  it('empty list is a pass-through (same ref)', () => {
    expect(applyFolderFilter(vids, [])).toBe(vids);
  });
});

describe('applyFilters', () => {
  it('composes length + name + folder', () => {
    const filter = {
      minDurationMs: null,
      maxDurationMs: null,
      namePatterns: ['VID_*'], // hides c
      ignoredFolders: ['/DCIM/Camera'], // hides a
    };
    expect(ids(applyFilters(vids, filter))).toEqual(['b', 'd']);
  });
  it('empty filter is a pass-through (same ref)', () => {
    expect(applyFilters(vids, EMPTY_FILTER)).toBe(vids);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- apply-filters`
Expected: FAIL — `applyNameFilter is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `src/library/filter-videos.ts`:

```ts
/** Hide a video if its filename matches ANY pattern. Empty list = pass-through. */
export function applyNameFilter(videos: LibraryVideo[], patterns: string[]): LibraryVideo[] {
  if (patterns.length === 0) return videos;
  return videos.filter((video) => !patterns.some((p) => matchesNamePattern(video.filename, p)));
}

/** Hide a video whose folder is in the ignored set. Empty list = pass-through. */
export function applyFolderFilter(videos: LibraryVideo[], ignoredFolders: string[]): LibraryVideo[] {
  if (ignoredFolders.length === 0) return videos;
  const set = new Set(ignoredFolders);
  return videos.filter((video) => !set.has(video.folder));
}

/** Compose length + name + folder. The single entry point used by the library hooks. */
export function applyFilters(videos: LibraryVideo[], filter: LibraryFilter): LibraryVideo[] {
  let result = applyLengthFilter(videos, filter);
  result = applyNameFilter(result, filter.namePatterns);
  result = applyFolderFilter(result, filter.ignoredFolders);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- apply-filters`
Expected: PASS (6 tests). Then `npm test` for the full suite — all green.

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-videos.ts src/library/__tests__/apply-filters.test.ts
git commit -m "feat(library): applyNameFilter, applyFolderFilter, composed applyFilters"
```

---

### Task 4: Wire `applyFilters` into the hooks

**Files:**
- Modify: `src/library/use-library.ts`
- Modify: `src/library/use-groups.ts`

**Interfaces:**
- Consumes: `applyFilters` (Task 3).
- Produces: no signature change; both hooks now apply all three rules before grouping.

**Note:** Glue. Verified by tsc/tests + user on-device.

- [ ] **Step 1: `use-library.ts`**

Change the import line `import { applyLengthFilter } from './filter-videos';` to:

```ts
import { applyFilters } from './filter-videos';
```

In the `groups` memo, change `const visible = applyLengthFilter(videos, filter);` to:

```ts
    const visible = applyFilters(videos, filter);
```

- [ ] **Step 2: `use-groups.ts`**

Make the identical two changes: the import `applyLengthFilter` → `applyFilters`, and the memo's `applyLengthFilter(videos, filter)` → `applyFilters(videos, filter)`.

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass. (`applyLengthFilter` is now used only inside `filter-videos.ts`; confirm no other file still imports it: `grep -rn "applyLengthFilter" src` should show only `filter-videos.ts`.)

- [ ] **Step 4: Commit**

```bash
git add src/library/use-library.ts src/library/use-groups.ts
git commit -m "feat(library): apply name + folder filters via applyFilters in both hooks"
```

---

### Task 5: Extend `FilterSettingsProvider` with name/folder state + mutators

**Files:**
- Modify: `src/library/filter-settings.tsx`

**Interfaces:**
- Consumes: `getSetting`/`setSetting`; `EMPTY_FILTER`, `LibraryFilter` (Task 1).
- Produces — `useFilterSettings()` now returns, in addition to `filter`/`setMin`/`setMax`:
  - `addNamePattern: (pattern: string) => void`
  - `removeNamePattern: (pattern: string) => void`
  - `toggleFolder: (path: string) => void`

**Note:** Glue. Verified by tsc/tests + user on-device.

- [ ] **Step 1: Replace the body of `filter-settings.tsx`**

Replace the whole file with (keeps `parseMs`, adds array keys + JSON parsing + mutators):

```tsx
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
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/library/filter-settings.tsx
git commit -m "feat(library): persist name patterns + ignored folders with add/remove/toggle"
```

---

### Task 6: `NamePatternList` component

**Files:**
- Create: `src/components/name-pattern-list.tsx`

**Interfaces:**
- Consumes: `useTheme` (`colors`, `radius`).
- Produces: `function NamePatternList(props: { patterns: string[]; onAdd: (p: string) => void; onRemove: (p: string) => void })`.

**Note:** Presentational UI. Verified by tsc + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/name-pattern-list.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function NamePatternList({
  patterns,
  onAdd,
  onRemove,
}: {
  patterns: string[];
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
}) {
  const { colors, radius } = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const p = text.trim();
    if (p === '') return;
    onAdd(p);
    setText('');
  };

  return (
    <View style={styles.wrap}>
      {patterns.map((p) => (
        <View
          key={p}
          style={[styles.row, { backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
          <Text style={[styles.rowText, { color: colors.onSurface }]} numberOfLines={1}>
            {p}
          </Text>
          <Pressable onPress={() => onRemove(p)} hitSlop={8} style={styles.remove}>
            <Text style={{ color: colors.onSurfaceVariant ?? '#aaa', fontSize: 16, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Add pattern…"
          placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: colors.onSurface, borderColor: colors.outline ?? '#555', borderRadius: radius.md },
          ]}
        />
        <Pressable onPress={submit} style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
          <Text style={{ color: colors.onPrimary ?? '#fff', fontWeight: '700' }}>Add</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8, paddingVertical: 6 },
  rowText: { flex: 1, fontWeight: '600' },
  remove: { paddingHorizontal: 8, paddingVertical: 2 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 10 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/name-pattern-list.tsx
git commit -m "feat(library): NamePatternList (removable rows + add input)"
```

---

### Task 7: `FolderIgnoreList` component

**Files:**
- Create: `src/components/folder-ignore-list.tsx`

**Interfaces:**
- Consumes: `useTheme` (`colors`).
- Produces:
  - `interface FolderEntry { path: string; name: string; count: number }`
  - `function FolderIgnoreList(props: { folders: FolderEntry[]; ignoredFolders: string[]; onToggle: (path: string) => void })`

**Note:** Presentational UI. Verified by tsc + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/folder-ignore-list.tsx`:

```tsx
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export interface FolderEntry {
  path: string;
  name: string;
  count: number;
}

export function FolderIgnoreList({
  folders,
  ignoredFolders,
  onToggle,
}: {
  folders: FolderEntry[];
  ignoredFolders: string[];
  onToggle: (path: string) => void;
}) {
  const { colors } = useTheme();

  if (folders.length === 0) {
    return <Text style={{ color: colors.onSurfaceVariant ?? '#888' }}>No folders found.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {folders.map((f) => {
        const shown = !ignoredFolders.includes(f.path);
        return (
          <View key={f.path} style={styles.row}>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                {f.name || 'Unknown'}
              </Text>
              <Text style={[styles.meta, { color: colors.onSurfaceVariant ?? '#888' }]} numberOfLines={1}>
                {f.count} video{f.count === 1 ? '' : 's'}
              </Text>
            </View>
            <Switch value={shown} onValueChange={() => onToggle(f.path)} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/folder-ignore-list.tsx
git commit -m "feat(library): FolderIgnoreList (per-folder Switch, off = ignored)"
```

---

### Task 8: Settings screen — name + folder subsections

**Files:**
- Modify: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useFilterSettings` (now with `addNamePattern`/`removeNamePattern`/`toggleFolder`, Task 5); `NamePatternList` (Task 6); `FolderIgnoreList` + `FolderEntry` (Task 7); `applyFilters` (Task 3); `groupByFolder` from `src/library/group-videos.ts`.
- Produces: the full filters UI.

**Note:** UI/glue. Verified by tsc/tests + user on-device.

- [ ] **Step 1: Replace the contents of `src/app/settings.tsx`**

Replace the whole file with (keeps the length rows; the footer now uses `applyFilters`; adds the two subsections; derives folders from `allVideos` via `groupByFolder`):

```tsx
// src/app/settings.tsx
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { FolderIgnoreList, type FolderEntry } from '@/components/folder-ignore-list';
import { NamePatternList } from '@/components/name-pattern-list';
import { Screen } from '@/components/screen';
import { getAllVideos } from '@/db/videos-repo';
import { applyFilters } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
import { groupByFolder } from '@/library/group-videos';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

const MIN_PRESETS: LengthPreset[] = [
  { label: '10s', ms: 10_000 },
  { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 },
  { label: '5m', ms: 300_000 },
];

const MAX_PRESETS: LengthPreset[] = [
  { label: '1h', ms: 3_600_000 },
  { label: '2h', ms: 7_200_000 },
  { label: '3h', ms: 10_800_000 },
];

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const { filter, setMin, setMax, addNamePattern, removeNamePattern, toggleFolder } = useFilterSettings();
  const [dialog, setDialog] = useState<'min' | 'max' | null>(null);
  const [allVideos, setAllVideos] = useState<LibraryVideo[]>([]);

  // Load the full library once for the folder list + live "Hiding N videos" footer.
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((all) => {
        if (!cancelled) setAllVideos(all);
      })
      .catch(() => {
        // Non-essential; ignore read failures.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const folderEntries = useMemo<FolderEntry[]>(
    () =>
      groupByFolder(allVideos)
        .map((g) => ({ path: g.key, name: g.title, count: g.count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allVideos],
  );

  const hidden = allVideos.length - applyFilters(allVideos, filter).length;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <ScrollView contentContainerStyle={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.section, { color: colors.onSurface }]}>Library filters</Text>

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos shorter than</Text>
          <FilterChips presets={MIN_PRESETS} value={filter.minDurationMs} onSelect={setMin} onCustom={() => setDialog('min')} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hide videos longer than</Text>
          <FilterChips presets={MAX_PRESETS} value={filter.maxDurationMs} onSelect={setMax} onCustom={() => setDialog('max')} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Ignore videos named</Text>
          <NamePatternList patterns={filter.namePatterns} onAdd={addNamePattern} onRemove={removeNamePattern} />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>Hidden folders</Text>
          <FolderIgnoreList folders={folderEntries} ignoredFolders={filter.ignoredFolders} onToggle={toggleFolder} />

          <Text style={[styles.footer, { color: colors.onSurfaceVariant ?? '#888' }]}>
            {hidden > 0 ? `Hiding ${hidden} video${hidden === 1 ? '' : 's'}` : 'No videos hidden'}
          </Text>
        </View>
      </ScrollView>

      <CustomLengthDialog
        visible={dialog !== null}
        initialMs={dialog === 'min' ? filter.minDurationMs : dialog === 'max' ? filter.maxDurationMs : null}
        onCancel={() => setDialog(null)}
        onConfirm={(ms) => {
          if (dialog === 'min') setMin(ms);
          else if (dialog === 'max') setMax(ms);
          setDialog(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 14, fontWeight: '600', marginTop: 8 },
  footer: { fontSize: 13, marginTop: 8 },
});
```

- [ ] **Step 2: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

> If `tsc` complains only about the `settings` route type, that's the typed-routes regen quirk (`.expo/types/router.d.ts`, regenerated by `expo start`) — note it and proceed. Any other error is real.

- [ ] **Step 3: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat(library): name-pattern + folder-ignore UI in Settings"
```

---

## Device verification checklist (for the user)

Run `npx expo start` (JS-only — no rebuild). Then:

- [ ] Settings "Library filters" now has **Ignore videos named** (add field + removable chips) and **Hidden folders** (folder list with switches) below the length rows.
- [ ] Adding a pattern (e.g. `trailer`) hides matching videos across library/folders/search/group-detail; footer updates.
- [ ] A glob pattern (e.g. `VID_*` or `*.gif`) hides matching files; a plain word matches as a substring.
- [ ] Removing a pattern (✕) unhides those videos.
- [ ] Switching a folder **off** hides all its videos everywhere; switching back **on** restores them.
- [ ] Blank and duplicate pattern adds do nothing.
- [ ] Name patterns and folder choices **persist across an app restart**.
- [ ] The "Hiding N videos" footer reflects length + name + folder combined.

---

## Self-Review

**Spec coverage:**
- `LibraryFilter` extension + JSON persistence keys → Task 1 (+ Task 5 loading). ✓
- Name match (substring/glob, case-insensitive, blank no-op, filename target) → Task 2 (+ tests). ✓
- `applyNameFilter` / `applyFolderFilter` / `applyFilters` (compose, empty pass-through) → Task 3 (+ tests). ✓
- Applied app-wide before grouping in both hooks → Task 4. ✓
- Context mutators (add/remove/toggle), defensive JSON parse → Task 5. ✓
- Name UI (removable list + add, no blank/dup) → Task 6 + wired in Task 8. ✓
- Folder UI (per-folder switch from library folders) → Task 7 + wired in Task 8. ✓
- Footer reflects all three via `applyFilters` → Task 8. ✓
- Type rename across the 3 referents → Task 1. ✓
- Out of scope (long-press hide, regex) → absent. ✓

**Placeholder scan:** No TBD/TODO; full code in every code step. ✓

**Type consistency:** `LibraryFilter`/`EMPTY_FILTER`/`applyFilters` (Tasks 1,3), `matchesNamePattern` (Task 2), `addNamePattern`/`removeNamePattern`/`toggleFolder` (Task 5 ↔ used in Task 8), `FolderEntry`/`FolderIgnoreList` (Task 7 ↔ Task 8), `NamePatternList` (Task 6 ↔ Task 8), `groupByFolder` returns `Group{key,title,count}` mapped to `FolderEntry` in Task 8. ✓
