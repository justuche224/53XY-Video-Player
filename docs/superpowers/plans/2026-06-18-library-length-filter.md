# Library Length Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent, length-based "ignore" rules that hide videos shorter than a min and/or longer than a max, configured in Settings and applied everywhere in the library.

**Architecture:** A pure filter function (`applyLengthFilter`) runs over the scanned video list before grouping in `useLibrary`. Thresholds persist in the existing SQLite `settings` key/value store and are exposed reactively through a new `FilterSettingsProvider` context that both the library hook (reader) and the Settings screen (writer) consume. The Settings screen renders chip rows (presets + a custom-value dialog) and a live "Hiding N videos" footer.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, TypeScript, Jest (jest-expo), Reanimated (existing `pressable-scale`), Material You theme tokens (`useTheme`).

## Global Constraints

- **Expo SDK 56 / RN 0.85.** Per `AGENTS.md`, read https://docs.expo.dev/versions/v56.0.0/ before writing any SDK code; verify thin docs against `node_modules/<pkg>/build/types/*.d.ts`.
- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Package manager is `bun`.** Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **JS-only feature — no native module touched.** Fast Refresh applies (`npx expo start`); no `npx expo run:android` rebuild needed.
- **Android-only.**
- **Pure logic is Jest-tested; UI/glue (context, hook wiring, screens) is device-verified by the user** (no device available to the agent). For UI/glue tasks the agent gate is `npx tsc --noEmit` + `npm test` clean + a manual checklist for the user.
- Tests live in `__tests__/` dirs next to the code (`testMatch: **/__tests__/**/*.test.ts(x)`).

---

### Task 1: Pure length-filter logic

**Files:**
- Create: `src/library/filter-videos.ts`
- Test: `src/library/__tests__/filter-videos.test.ts`

**Interfaces:**
- Consumes: `LibraryVideo` from `src/library/types.ts` (`{ id, durationMs: number | null, ... }`).
- Produces:
  - `interface LengthFilter { minDurationMs: number | null; maxDurationMs: number | null }`
  - `const EMPTY_FILTER: LengthFilter`
  - `function applyLengthFilter(videos: LibraryVideo[], filter: LengthFilter): LibraryVideo[]`

- [ ] **Step 1: Write the failing test**

Create `src/library/__tests__/filter-videos.test.ts`:

```ts
import { applyLengthFilter, EMPTY_FILTER, type LengthFilter } from '../filter-videos';
import type { LibraryVideo } from '../types';

const v = (id: string, durationMs: number | null): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs,
  width: null,
  height: null,
  folder: 'Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const ids = (vs: LibraryVideo[]) => vs.map((x) => x.id);

describe('applyLengthFilter', () => {
  const vids = [v('a', 5_000), v('b', 30_000), v('c', 3_600_000), v('d', null)];

  it('empty filter returns the same array reference (pass-through)', () => {
    expect(applyLengthFilter(vids, EMPTY_FILTER)).toBe(vids);
  });

  it('min only hides videos strictly shorter than min', () => {
    const f: LengthFilter = { minDurationMs: 30_000, maxDurationMs: null };
    // 'a' (5s) hidden; 'b' (exactly 30s) kept; 'c' kept; 'd' (unknown) kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['b', 'c', 'd']);
  });

  it('max only hides videos strictly longer than max', () => {
    const f: LengthFilter = { minDurationMs: null, maxDurationMs: 3_600_000 };
    // 'c' (exactly 1h) kept; nothing over 1h here → all kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('both min and max keep only the in-range, plus unknown', () => {
    const f: LengthFilter = { minDurationMs: 10_000, maxDurationMs: 60_000 };
    // 'a'(5s) hidden, 'b'(30s) kept, 'c'(1h) hidden, 'd'(unknown) kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['b', 'd']);
  });

  it('never hides videos with unknown (null) duration', () => {
    const f: LengthFilter = { minDurationMs: 1_000_000, maxDurationMs: 2_000_000 };
    expect(ids(applyLengthFilter(vids, f))).toContain('d');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- filter-videos`
Expected: FAIL — `Cannot find module '../filter-videos'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/library/filter-videos.ts`:

```ts
import type { LibraryVideo } from './types';

export interface LengthFilter {
  /** Hide videos strictly shorter than this many ms. null = no minimum. */
  minDurationMs: number | null;
  /** Hide videos strictly longer than this many ms. null = no maximum. */
  maxDurationMs: number | null;
}

export const EMPTY_FILTER: LengthFilter = { minDurationMs: null, maxDurationMs: null };

/**
 * Keep videos whose duration is within [min, max]. Videos with unknown
 * (null) duration are always kept — we don't hide what we can't measure.
 * Comparison is strict, so a video exactly at a threshold stays visible.
 * An empty filter is a pass-through (returns the same array reference).
 */
export function applyLengthFilter(videos: LibraryVideo[], filter: LengthFilter): LibraryVideo[] {
  const { minDurationMs, maxDurationMs } = filter;
  if (minDurationMs == null && maxDurationMs == null) return videos;
  return videos.filter((video) => {
    const d = video.durationMs;
    if (d == null) return true;
    if (minDurationMs != null && d < minDurationMs) return false;
    if (maxDurationMs != null && d > maxDurationMs) return false;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- filter-videos`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-videos.ts src/library/__tests__/filter-videos.test.ts
git commit -m "feat(library): pure length-based ignore filter"
```

---

### Task 2: Pure length-unit helpers

**Files:**
- Modify: `src/library/filter-videos.ts`
- Test: `src/library/__tests__/length-units.test.ts`

**Interfaces:**
- Produces (added to `filter-videos.ts`):
  - `type LengthUnit = 'sec' | 'min' | 'hr'`
  - `function partsToMs(value: number, unit: LengthUnit): number`
  - `function msToParts(ms: number): { value: number; unit: LengthUnit }`
  - `function formatLengthShort(ms: number): string` (e.g. `30_000 → "30s"`, `60_000 → "1m"`, `3_600_000 → "1h"`)

- [ ] **Step 1: Write the failing test**

Create `src/library/__tests__/length-units.test.ts`:

```ts
import { formatLengthShort, msToParts, partsToMs } from '../filter-videos';

describe('partsToMs', () => {
  it('converts each unit to ms', () => {
    expect(partsToMs(45, 'sec')).toBe(45_000);
    expect(partsToMs(5, 'min')).toBe(300_000);
    expect(partsToMs(2, 'hr')).toBe(7_200_000);
  });
  it('rounds fractional ms', () => {
    expect(partsToMs(1.5, 'sec')).toBe(1_500);
  });
});

describe('msToParts', () => {
  it('picks the largest whole unit', () => {
    expect(msToParts(3_600_000)).toEqual({ value: 1, unit: 'hr' });
    expect(msToParts(300_000)).toEqual({ value: 5, unit: 'min' });
    expect(msToParts(45_000)).toEqual({ value: 45, unit: 'sec' });
  });
  it('falls back to seconds for non-whole min/hr', () => {
    expect(msToParts(90_000)).toEqual({ value: 90, unit: 'sec' });
  });
});

describe('formatLengthShort', () => {
  it('formats with the unit suffix', () => {
    expect(formatLengthShort(30_000)).toBe('30s');
    expect(formatLengthShort(60_000)).toBe('1m');
    expect(formatLengthShort(3_600_000)).toBe('1h');
    expect(formatLengthShort(90_000)).toBe('90s');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- length-units`
Expected: FAIL — `partsToMs is not a function` / export missing.

- [ ] **Step 3: Write minimal implementation**

Append to `src/library/filter-videos.ts`:

```ts
export type LengthUnit = 'sec' | 'min' | 'hr';

const UNIT_MS: Record<LengthUnit, number> = { sec: 1_000, min: 60_000, hr: 3_600_000 };
const UNIT_SUFFIX: Record<LengthUnit, string> = { sec: 's', min: 'm', hr: 'h' };

export function partsToMs(value: number, unit: LengthUnit): number {
  return Math.round(value * UNIT_MS[unit]);
}

export function msToParts(ms: number): { value: number; unit: LengthUnit } {
  if (ms % UNIT_MS.hr === 0) return { value: ms / UNIT_MS.hr, unit: 'hr' };
  if (ms % UNIT_MS.min === 0) return { value: ms / UNIT_MS.min, unit: 'min' };
  return { value: Math.round(ms / UNIT_MS.sec), unit: 'sec' };
}

export function formatLengthShort(ms: number): string {
  const { value, unit } = msToParts(ms);
  return `${value}${UNIT_SUFFIX[unit]}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- length-units`
Expected: PASS (5 tests). Also run `npm test -- filter-videos` to confirm Task 1 still green.

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-videos.ts src/library/__tests__/length-units.test.ts
git commit -m "feat(library): length-unit conversion + short-format helpers"
```

---

### Task 3: Filter settings context + mount in layout

**Files:**
- Create: `src/library/filter-settings.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `getSetting`/`setSetting` from `src/db/settings-repo.ts`; `useSQLiteContext` from `expo-sqlite`; `EMPTY_FILTER`, `LengthFilter` from `src/library/filter-videos.ts`.
- Produces:
  - `function FilterSettingsProvider({ children }: { children: ReactNode })`
  - `function useFilterSettings(): { filter: LengthFilter; setMin(ms: number | null): void; setMax(ms: number | null): void }`

**Note:** This is glue (React context + SQLite). No Jest test — verified by `tsc`/`npm test` staying green and by the user on-device.

- [ ] **Step 1: Create the context**

Create `src/library/filter-settings.tsx`:

```tsx
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
```

- [ ] **Step 2: Mount the provider in `_layout.tsx`**

In `src/app/_layout.tsx`, add the import and wrap the themed tree (it must sit **inside** `SQLiteProvider` so `useSQLiteContext` resolves):

Add to imports:

```tsx
import { FilterSettingsProvider } from '@/library/filter-settings';
```

Change the provider tree from:

```tsx
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <ThemeProvider>
            <ThemedStatusBar />
            <Stack screenOptions={{ headerShown: false }} />
          </ThemeProvider>
        </SQLiteProvider>
```

to:

```tsx
        <SQLiteProvider databaseName="p53xy.db" onInit={onDbInit}>
          <FilterSettingsProvider>
            <ThemeProvider>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false }} />
            </ThemeProvider>
          </FilterSettingsProvider>
        </SQLiteProvider>
```

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/library/filter-settings.tsx src/app/_layout.tsx
git commit -m "feat(library): reactive filter-settings context, mounted in root layout"
```

---

### Task 4: Apply the filter in `useLibrary`

**Files:**
- Modify: `src/library/use-library.ts`

**Interfaces:**
- Consumes: `useFilterSettings` (Task 3); `applyLengthFilter` (Task 1).
- Produces: no signature change to `useLibrary` — `groups` now reflect the active length filter.

**Note:** Glue. Verified by `tsc`/tests + user on-device.

- [ ] **Step 1: Import the filter pieces**

In `src/library/use-library.ts`, add to the imports near the other `./` imports:

```ts
import { useFilterSettings } from './filter-settings';
import { applyLengthFilter } from './filter-videos';
```

- [ ] **Step 2: Read the filter and apply it before grouping**

Inside `useLibrary`, add near the top (e.g. just after `const db = useSQLiteContext();`):

```ts
  const { filter } = useFilterSettings();
```

Replace the existing `groups` memo:

```ts
  const groups = useMemo(
    () => (mode === 'name' ? groupByName(videos) : groupByFolder(videos)),
    [videos, mode],
  );
```

with:

```ts
  const groups = useMemo(() => {
    const visible = applyLengthFilter(videos, filter);
    return mode === 'name' ? groupByName(visible) : groupByFolder(visible);
  }, [videos, mode, filter]);
```

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/library/use-library.ts
git commit -m "feat(library): apply length filter before grouping"
```

---

### Task 5: `FilterChips` component

**Files:**
- Create: `src/components/filter-chips.tsx`

**Interfaces:**
- Consumes: `useTheme` (`colors`, `radius`, `spacing`); `formatLengthShort` (Task 2).
- Produces:
  - `interface LengthPreset { label: string; ms: number }`
  - `function FilterChips(props: { presets: LengthPreset[]; value: number | null; onSelect: (ms: number | null) => void; onCustom: () => void })`

**Note:** Presentational UI. Verified by `tsc` + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/filter-chips.tsx` (chip styling mirrors `segmented-tabs.tsx`):

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatLengthShort } from '@/library/filter-videos';
import { useTheme } from '@/theme/theme-provider';

export interface LengthPreset {
  label: string;
  ms: number;
}

export function FilterChips({
  presets,
  value,
  onSelect,
  onCustom,
}: {
  presets: LengthPreset[];
  value: number | null; // active ms; null = "Off"
  onSelect: (ms: number | null) => void;
  onCustom: () => void;
}) {
  const { colors, radius } = useTheme();
  const isPreset = value != null && presets.some((p) => p.ms === value);
  const customActive = value != null && !isPreset;

  const chip = (key: string, label: string, active: boolean, onPress: () => void) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={[
        styles.chip,
        {
          borderRadius: radius.pill,
          backgroundColor: active ? colors.primary : colors.surfaceVariant ?? '#222',
        },
      ]}>
      <Text style={{ color: active ? colors.onPrimary ?? '#fff' : colors.onSurface, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.row}>
      {chip('off', 'Off', value == null, () => onSelect(null))}
      {presets.map((p) => chip(p.label, p.label, value === p.ms, () => onSelect(p.ms)))}
      {chip('custom', customActive ? formatLengthShort(value) : 'Custom…', customActive, onCustom)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/filter-chips.tsx
git commit -m "feat(library): FilterChips row (presets + Off + custom)"
```

---

### Task 6: `CustomLengthDialog` component

**Files:**
- Create: `src/components/custom-length-dialog.tsx`

**Interfaces:**
- Consumes: `useTheme`; `partsToMs`, `msToParts`, `type LengthUnit` (Task 2).
- Produces:
  - `function CustomLengthDialog(props: { visible: boolean; initialMs: number | null; onCancel: () => void; onConfirm: (ms: number) => void })`

**Note:** UI (Modal + TextInput). Verified by `tsc` + user on-device.

- [ ] **Step 1: Create the component**

Create `src/components/custom-length-dialog.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { msToParts, partsToMs, type LengthUnit } from '@/library/filter-videos';
import { useTheme } from '@/theme/theme-provider';

const UNITS: { key: LengthUnit; label: string }[] = [
  { key: 'sec', label: 'sec' },
  { key: 'min', label: 'min' },
  { key: 'hr', label: 'hr' },
];

export function CustomLengthDialog({
  visible,
  initialMs,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialMs: number | null;
  onCancel: () => void;
  onConfirm: (ms: number) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<LengthUnit>('min');

  // Prefill from the current value each time the dialog opens.
  useEffect(() => {
    if (!visible) return;
    if (initialMs != null) {
      const parts = msToParts(initialMs);
      setText(String(parts.value));
      setUnit(parts.unit);
    } else {
      setText('');
      setUnit('min');
    }
  }, [visible, initialMs]);

  const num = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(num) && num > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface ?? '#1b1b1b', borderRadius: radius.lg, padding: spacing.lg }]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Custom length</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
            style={[
              styles.input,
              { color: colors.onSurface, borderColor: colors.outline ?? '#555', borderRadius: radius.md },
            ]}
          />
          <View style={styles.unitRow}>
            {UNITS.map((u) => {
              const active = u.key === unit;
              return (
                <Pressable
                  key={u.key}
                  onPress={() => setUnit(u.key)}
                  style={[
                    styles.unitChip,
                    { borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surfaceVariant ?? '#222' },
                  ]}>
                  <Text style={{ color: active ? colors.onPrimary ?? '#fff' : colors.onSurface, fontWeight: '600' }}>
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.action}>
              <Text style={{ color: colors.onSurfaceVariant ?? '#aaa', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!valid}
              onPress={() => onConfirm(partsToMs(num, unit))}
              style={styles.action}>
              <Text style={{ color: valid ? colors.primary : colors.outline ?? '#555', fontWeight: '700' }}>Set</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  action: { paddingHorizontal: 16, paddingVertical: 8 },
});
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/custom-length-dialog.tsx
git commit -m "feat(library): custom-length dialog (number + unit)"
```

---

### Task 7: Settings screen — assemble the filter UI

**Files:**
- Modify: `src/app/settings.tsx`

**Interfaces:**
- Consumes: `useFilterSettings` (Task 3); `FilterChips` + `LengthPreset` (Task 5); `CustomLengthDialog` (Task 6); `applyLengthFilter` (Task 1); `getAllVideos` from `src/db/videos-repo.ts`; `useSQLiteContext`; `useTheme`.
- Produces: the live Settings screen (replaces the `Settings coming soon.` placeholder).

**Note:** UI/glue. Verified by `tsc`/tests + user on-device.

- [ ] **Step 1: Confirm the `getAllVideos` signature**

Run: `grep -n "export.*getAllVideos" src/db/videos-repo.ts`
Expected: `getAllVideos(db: SQLiteDatabase): Promise<LibraryVideo[]>` (used the same way in `use-library.ts`). Use it exactly as `use-library.ts` does.

- [ ] **Step 2: Replace the screen body**

Replace the entire contents of `src/app/settings.tsx` with:

```tsx
// src/app/settings.tsx
import { Stack } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { Screen } from '@/components/screen';
import { getAllVideos } from '@/db/videos-repo';
import { applyLengthFilter } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
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
  const { filter, setMin, setMax } = useFilterSettings();
  const [dialog, setDialog] = useState<'min' | 'max' | null>(null);
  const [allVideos, setAllVideos] = useState<LibraryVideo[]>([]);

  // Load the full library once to show the live "Hiding N videos" footer.
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((all) => {
        if (!cancelled) setAllVideos(all);
      })
      .catch(() => {
        // Footer is non-essential; ignore read failures.
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const hidden = allVideos.length - applyLengthFilter(allVideos, filter).length;

  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <ScrollView contentContainerStyle={{ gap: spacing.xl }}>
        <View style={{ gap: spacing.md }}>
          <Text style={[styles.section, { color: colors.onSurface }]}>Library filters</Text>

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>
            Hide videos shorter than
          </Text>
          <FilterChips
            presets={MIN_PRESETS}
            value={filter.minDurationMs}
            onSelect={setMin}
            onCustom={() => setDialog('min')}
          />

          <Text style={[styles.label, { color: colors.onSurfaceVariant ?? '#aaa' }]}>
            Hide videos longer than
          </Text>
          <FilterChips
            presets={MAX_PRESETS}
            value={filter.maxDurationMs}
            onSelect={setMax}
            onCustom={() => setDialog('max')}
          />

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

- [ ] **Step 3: Verify typecheck + tests**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all tests pass.

> If `tsc` complains about the `settings` route type, that's the typed-routes regen quirk noted in HANDOFF — it resolves once `expo start` regenerates `.expo/types/router.d.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat(library): length-filter UI in Settings with live hidden count"
```

---

## Device verification checklist (for the user)

Run `npx expo start` (JS-only — no rebuild needed). Then:

- [ ] Settings shows a **Library filters** section with two chip rows + a footer.
- [ ] Tapping a **min** preset (e.g. `30s`) hides shorter clips in the library/folders/search; footer updates to "Hiding N videos".
- [ ] Tapping a **max** preset (e.g. `1h`) hides longer videos.
- [ ] **Custom…** opens the dialog, prefilled if a value is set; entering a number + unit and tapping **Set** applies it and the Custom chip shows the short value (e.g. `90s`).
- [ ] **Off** clears that threshold.
- [ ] Filters **persist across an app restart**.
- [ ] A video whose duration is unknown is **never** hidden.

---

## Self-Review

**Spec coverage:**
- Persistent ignore rules (settings keys) → Task 3. ✓
- Min + max, independently toggleable, strict comparison, null kept, empty pass-through → Task 1 (+ tests). ✓
- Applied before grouping, everywhere → Task 4. ✓
- Reactive context consumed by reader + writer → Task 3. ✓
- Chips (Off/presets/Custom…) → Task 5; custom number+unit dialog → Task 6; "Hiding N videos" footer → Task 7. ✓
- Jest on pure logic; UI device-verified → Tasks 1–2 tested, 3–7 device-verified. ✓
- Out of scope (name/folder rules) → not present. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. ✓

**Type consistency:** `LengthFilter`/`applyLengthFilter`/`EMPTY_FILTER` (Task 1), `partsToMs`/`msToParts`/`formatLengthShort`/`LengthUnit` (Task 2), `useFilterSettings`/`FilterSettingsProvider` (Task 3), `FilterChips`/`LengthPreset` (Task 5), `CustomLengthDialog` (Task 6) — names match across consuming tasks. ✓
