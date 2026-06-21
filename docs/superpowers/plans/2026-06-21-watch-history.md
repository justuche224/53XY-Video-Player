# Watch History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a YouTube-style Watch History screen — played videos newest-first, bucketed by day, searchable, with progress bars, swipe-to-remove, clear-all, and robust deleted-media handling.

**Architecture:** History is a presentation layer over the existing `watch_progress` table joined against the in-memory library cache (`useLibraryData`). Pure helpers (`dayBucket`, `assembleHistory`, `filterHistory`) carry the testable logic; thin repo wrappers do the SQL; a new screen + swipeable row render it. Deleted media is handled in two layers: a display-time join filter and a scan-time cascade prune of orphaned progress rows.

**Tech Stack:** Expo SDK 56 / React Native 0.85, expo-sqlite, expo-router (typed routes), react-native-gesture-handler (`Swipeable`), Jest for pure logic.

## Global Constraints

- **Android-only**, Expo SDK 56. Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code; verify thin docs against `node_modules/<pkg>/build/types/*.d.ts`.
- **Package manager is `bun`.** `npx expo install` for Expo deps, `bun add` for others. No new deps needed for this feature.
- **Tests:** `npm test`. **Typecheck:** `npx tsc --noEmit` (must stay clean).
- **Commits are plain conventional commits — NO `Co-Authored-By` / "Generated with Claude Code" trailer.**
- **Testing convention (lean):** pure logic + SQL-shape get Jest tests; React/native UI is verified by `tsc` + the user's device build, NOT component tests (no RNTL harness in this repo). UI tasks below gate on `tsc`, not Jest.
- **No new native module** → JS-only; `npx expo start` reload is enough, no `expo run:android`.
- `duration_ms` / durations are **milliseconds**. `colors` is a full Material3 scheme (`surface`, `error`, `onSurfaceVariant`, etc. all exist); existing code uses `?? fallback` defensively — keep that style.

---

### Task 1: Migration v3 — index on `watch_progress(last_played_at)`

**Files:**
- Modify: `src/db/schema.ts`
- Test: `src/db/__tests__/schema.test.ts` (create)

**Interfaces:**
- Consumes: `MIGRATIONS`, `LATEST_VERSION` from `src/db/schema.ts`.
- Produces: migration version 3 adding `idx_watch_progress_last_played`; `LATEST_VERSION === 3`.

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/schema.test.ts`:

```ts
import { MIGRATIONS, LATEST_VERSION } from '../schema';

describe('schema migrations', () => {
  it('LATEST_VERSION matches the highest migration version', () => {
    const max = Math.max(...MIGRATIONS.map((m) => m.version));
    expect(LATEST_VERSION).toBe(max);
  });

  it('has a v3 migration that indexes watch_progress.last_played_at', () => {
    const v3 = MIGRATIONS.find((m) => m.version === 3);
    expect(v3).toBeDefined();
    expect(v3!.up).toMatch(/CREATE INDEX IF NOT EXISTS idx_watch_progress_last_played/);
    expect(v3!.up).toMatch(/watch_progress\s*\(\s*last_played_at\s*\)/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- schema.test`
Expected: FAIL — no v3 migration; `LATEST_VERSION` is 2.

- [ ] **Step 3: Implement the migration**

In `src/db/schema.ts`, append a third entry to the `MIGRATIONS` array (after version 2) and bump `LATEST_VERSION`:

```ts
  {
    version: 3,
    up: `CREATE INDEX IF NOT EXISTS idx_watch_progress_last_played
         ON watch_progress(last_played_at);`,
  },
];

export const LATEST_VERSION = 3;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- schema.test`
Expected: PASS (both tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/db/schema.ts src/db/__tests__/schema.test.ts
git commit -m "feat(db): add watch_progress last_played_at index (migration v3)"
```

---

### Task 2: Data layer — `deleteProgressByIds` + `history-repo`

**Files:**
- Modify: `src/db/progress-repo.ts`
- Create: `src/db/history-repo.ts`
- Test: `src/db/__tests__/history-repo.test.ts` (create)

**Interfaces:**
- Consumes: `SQLiteDatabase` (only `runAsync`, `getAllAsync` used).
- Produces:
  - `deleteProgressByIds(db, ids: string[]): Promise<void>` (in `progress-repo.ts`)
  - `HistoryRow = { videoId: string; positionMs: number; percent: number; lastPlayedAt: number }`
  - `getHistory(db): Promise<HistoryRow[]>`
  - `removeHistory(db, videoId: string): Promise<void>`
  - `clearHistory(db): Promise<void>`

These are SQL wrappers; the test uses a fake db that records the SQL string + params (mirrors the `makeFakeDb` style in `migrate.test.ts`). `deleteProgressByIds` has real placeholder-building logic worth asserting.

- [ ] **Step 1: Write the failing test**

Create `src/db/__tests__/history-repo.test.ts`:

```ts
import { getHistory, removeHistory, clearHistory, type HistoryRow } from '../history-repo';
import { deleteProgressByIds } from '../progress-repo';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = []) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return undefined as never;
    },
    async getAllAsync<T>(sql: string) {
      calls.push({ sql });
      return rows as T[];
    },
  };
  return { db: db as never, calls };
}

describe('history-repo', () => {
  it('getHistory selects ordered by last_played_at desc and maps rows', async () => {
    const dbRows = [
      { video_id: 'a', position_ms: 10, percent: 0.5, last_played_at: 200 },
      { video_id: 'b', position_ms: 0, percent: 0, last_played_at: 100 },
    ];
    const { db, calls } = fakeDb(dbRows);
    const result: HistoryRow[] = await getHistory(db);
    expect(calls[0].sql).toMatch(/FROM watch_progress/);
    expect(calls[0].sql).toMatch(/ORDER BY last_played_at DESC/);
    expect(result).toEqual([
      { videoId: 'a', positionMs: 10, percent: 0.5, lastPlayedAt: 200 },
      { videoId: 'b', positionMs: 0, percent: 0, lastPlayedAt: 100 },
    ]);
  });

  it('removeHistory deletes a single row by id', async () => {
    const { db, calls } = fakeDb();
    await removeHistory(db, 'x');
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress WHERE video_id = \?/);
    expect(calls[0].params).toEqual(['x']);
  });

  it('clearHistory deletes all rows', async () => {
    const { db, calls } = fakeDb();
    await clearHistory(db);
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress/);
    expect(calls[0].sql).not.toMatch(/WHERE/);
  });
});

describe('deleteProgressByIds', () => {
  it('is a no-op on empty ids', async () => {
    const { db, calls } = fakeDb();
    await deleteProgressByIds(db, []);
    expect(calls).toEqual([]);
  });

  it('builds a placeholder IN clause with the ids as params', async () => {
    const { db, calls } = fakeDb();
    await deleteProgressByIds(db, ['a', 'b', 'c']);
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress WHERE video_id IN \(\?,\?,\?\)/);
    expect(calls[0].params).toEqual(['a', 'b', 'c']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- history-repo`
Expected: FAIL — `history-repo` module and `deleteProgressByIds` do not exist.

- [ ] **Step 3a: Add `deleteProgressByIds` to `progress-repo.ts`**

Append to `src/db/progress-repo.ts`:

```ts
export async function deleteProgressByIds(db: SQLiteDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM watch_progress WHERE video_id IN (${placeholders})`, ids);
}
```

- [ ] **Step 3b: Create `src/db/history-repo.ts`**

```ts
import type { SQLiteDatabase } from 'expo-sqlite';

export interface HistoryRow {
  videoId: string;
  positionMs: number;
  percent: number;
  lastPlayedAt: number;
}

interface HistoryDbRow {
  video_id: string;
  position_ms: number;
  percent: number;
  last_played_at: number;
}

export async function getHistory(db: SQLiteDatabase): Promise<HistoryRow[]> {
  const rows = await db.getAllAsync<HistoryDbRow>(
    `SELECT video_id, position_ms, percent, last_played_at
     FROM watch_progress
     ORDER BY last_played_at DESC`,
  );
  return rows.map((r) => ({
    videoId: r.video_id,
    positionMs: r.position_ms,
    percent: r.percent,
    lastPlayedAt: r.last_played_at,
  }));
}

export async function removeHistory(db: SQLiteDatabase, videoId: string): Promise<void> {
  await db.runAsync('DELETE FROM watch_progress WHERE video_id = ?', [videoId]);
}

export async function clearHistory(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM watch_progress');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- history-repo`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/db/progress-repo.ts src/db/history-repo.ts src/db/__tests__/history-repo.test.ts
git commit -m "feat(db): history-repo (get/remove/clear) + deleteProgressByIds"
```

---

### Task 3: Pure helper — `dayBucket`

**Files:**
- Create: `src/history/bucket-day.ts`
- Test: `src/history/__tests__/bucket-day.test.ts` (create)

**Interfaces:**
- Produces: `DayBucket = { key: string; label: string }`; `dayBucket(timestampMs: number, nowMs: number): DayBucket`.
- `key` is the local-midnight epoch (stable section id); `label` is `Today` / `Yesterday` / `Mon D` (same calendar year) / `Mon D, YYYY` (older year). Buckets compare **local calendar days**, not 24h windows. `nowMs` is injected for determinism.

- [ ] **Step 1: Write the failing test**

Create `src/history/__tests__/bucket-day.test.ts`:

```ts
import { dayBucket } from '../bucket-day';

// Build local-time timestamps so they line up with local-midnight bucketing.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();

describe('dayBucket', () => {
  const now = at(2026, 5, 21, 15); // Jun 21 2026, 3pm local

  it('labels the same calendar day as Today', () => {
    expect(dayBucket(at(2026, 5, 21, 1), now).label).toBe('Today');
    expect(dayBucket(at(2026, 5, 21, 23), now).label).toBe('Today');
  });

  it('labels the previous calendar day as Yesterday', () => {
    expect(dayBucket(at(2026, 5, 20, 23), now).label).toBe('Yesterday');
  });

  it('labels an older day this year as "Mon D"', () => {
    expect(dayBucket(at(2026, 5, 19, 9), now).label).toBe('Jun 19');
  });

  it('labels a day in a previous year as "Mon D, YYYY"', () => {
    expect(dayBucket(at(2025, 11, 30, 9), now).label).toBe('Dec 30, 2025');
  });

  it('gives the same key for two times on the same local day', () => {
    expect(dayBucket(at(2026, 5, 19, 1), now).key).toBe(dayBucket(at(2026, 5, 19, 22), now).key);
  });

  it('gives different keys for different days', () => {
    expect(dayBucket(at(2026, 5, 19, 1), now).key).not.toBe(dayBucket(at(2026, 5, 20, 1), now).key);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- bucket-day`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/history/bucket-day.ts`**

```ts
export interface DayBucket {
  key: string;
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function dayBucket(timestampMs: number, nowMs: number): DayBucket {
  const day = startOfLocalDay(timestampMs);
  const today = startOfLocalDay(nowMs);
  const key = String(day);
  const diffDays = Math.round((today - day) / DAY_MS);

  if (diffDays <= 0) return { key, label: 'Today' };
  if (diffDays === 1) return { key, label: 'Yesterday' };

  const d = new Date(timestampMs);
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  const label = d.getFullYear() === new Date(nowMs).getFullYear() ? base : `${base}, ${d.getFullYear()}`;
  return { key, label };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- bucket-day`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/history/bucket-day.ts src/history/__tests__/bucket-day.test.ts
git commit -m "feat(history): dayBucket helper (Today/Yesterday/date sections)"
```

---

### Task 4: Pure helper — `assembleHistory` + `filterHistory` + types

**Files:**
- Create: `src/history/types.ts`
- Create: `src/history/assemble-history.ts`
- Test: `src/history/__tests__/assemble-history.test.ts` (create)

**Interfaces:**
- Consumes: `HistoryRow` from `src/db/history-repo.ts`; `LibraryVideo` from `src/library/types.ts`; `dayBucket` from `src/history/bucket-day.ts`.
- Produces (in `src/history/types.ts`):
  - `HistoryItem = { video: LibraryVideo; percent: number; lastPlayedAt: number }`
  - `HistorySection = { key: string; title: string; data: HistoryItem[] }`
- Produces (in `src/history/assemble-history.ts`):
  - `assembleHistory(rows: HistoryRow[], videos: LibraryVideo[], nowMs: number): HistorySection[]` — joins rows to videos by id, **drops rows whose video is absent** (deleted-media filter), buckets into day sections preserving input (newest-first) order.
  - `filterHistory(sections: HistorySection[], query: string): HistorySection[]` — case-insensitive substring filter on `video.filename`; drops emptied sections; empty/whitespace query returns input unchanged.

- [ ] **Step 1: Write the failing test**

Create `src/history/__tests__/assemble-history.test.ts`:

```ts
import { assembleHistory, filterHistory } from '../assemble-history';
import type { LibraryVideo } from '@/library/types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const now = at(2026, 5, 21, 15);

const vid = (id: string, filename = `${id}.mp4`): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename,
  durationMs: 1000,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const row = (videoId: string, lastPlayedAt: number, percent = 0.4) => ({
  videoId,
  positionMs: 100,
  percent,
  lastPlayedAt,
});

describe('assembleHistory', () => {
  it('joins rows to videos and buckets them by day, newest-first', () => {
    const rows = [
      row('a', at(2026, 5, 21, 14)),
      row('b', at(2026, 5, 20, 10)),
      row('c', at(2026, 5, 19, 10)),
    ];
    const videos = [vid('a'), vid('b'), vid('c')];
    const sections = assembleHistory(rows, videos, now);
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Yesterday', 'Jun 19']);
    expect(sections[0].data[0].video.id).toBe('a');
    expect(sections[0].data[0].percent).toBe(0.4);
  });

  it('groups multiple entries from the same day into one section in order', () => {
    const rows = [row('a', at(2026, 5, 21, 14)), row('b', at(2026, 5, 21, 9))];
    const sections = assembleHistory(rows, [vid('a'), vid('b')], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((i) => i.video.id)).toEqual(['a', 'b']);
  });

  it('drops rows whose video is missing (deleted media)', () => {
    const rows = [row('a', at(2026, 5, 21, 14)), row('gone', at(2026, 5, 21, 9))];
    const sections = assembleHistory(rows, [vid('a')], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((i) => i.video.id)).toEqual(['a']);
  });

  it('returns an empty array when nothing resolves', () => {
    expect(assembleHistory([row('gone', now)], [], now)).toEqual([]);
  });
});

describe('filterHistory', () => {
  const sections = [
    { key: '1', title: 'Today', data: [
      { video: vid('a', 'Inception.mp4'), percent: 0.1, lastPlayedAt: 1 },
      { video: vid('b', 'Tenet.mkv'), percent: 0.2, lastPlayedAt: 2 },
    ] },
    { key: '2', title: 'Yesterday', data: [
      { video: vid('c', 'Dunkirk.mp4'), percent: 0.3, lastPlayedAt: 3 },
    ] },
  ];

  it('returns input unchanged for an empty query', () => {
    expect(filterHistory(sections, '   ')).toBe(sections);
  });

  it('filters items by filename substring, case-insensitive, dropping empty sections', () => {
    const result = filterHistory(sections, 'ten');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Today');
    expect(result[0].data.map((i) => i.video.id)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- assemble-history`
Expected: FAIL — modules not found.

- [ ] **Step 3a: Create `src/history/types.ts`**

```ts
import type { LibraryVideo } from '@/library/types';

export interface HistoryItem {
  video: LibraryVideo;
  percent: number;
  lastPlayedAt: number;
}

export interface HistorySection {
  key: string;
  title: string;
  data: HistoryItem[];
}
```

- [ ] **Step 3b: Create `src/history/assemble-history.ts`**

```ts
import type { HistoryRow } from '@/db/history-repo';
import type { LibraryVideo } from '@/library/types';
import { dayBucket } from './bucket-day';
import type { HistorySection } from './types';

export function assembleHistory(
  rows: HistoryRow[],
  videos: LibraryVideo[],
  nowMs: number,
): HistorySection[] {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const sections: HistorySection[] = [];
  const index = new Map<string, HistorySection>();

  for (const r of rows) {
    const video = byId.get(r.videoId);
    if (!video) continue; // deleted media — never shown
    const b = dayBucket(r.lastPlayedAt, nowMs);
    let section = index.get(b.key);
    if (!section) {
      section = { key: b.key, title: b.label, data: [] };
      index.set(b.key, section);
      sections.push(section);
    }
    section.data.push({ video, percent: r.percent, lastPlayedAt: r.lastPlayedAt });
  }

  return sections;
}

export function filterHistory(sections: HistorySection[], query: string): HistorySection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => ({ ...s, data: s.data.filter((i) => i.video.filename.toLowerCase().includes(q)) }))
    .filter((s) => s.data.length > 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- assemble-history`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/history/types.ts src/history/assemble-history.ts src/history/__tests__/assemble-history.test.ts
git commit -m "feat(history): assembleHistory + filterHistory pure helpers"
```

---

### Task 5: Cascade prune orphaned progress on scan reconcile

**Files:**
- Modify: `src/library/library-provider.tsx`

**Interfaces:**
- Consumes: `deleteProgressByIds` from `src/db/progress-repo.ts` (Task 2).
- Produces: no new exports — the existing scan-reconcile now also prunes `watch_progress` rows for removed videos.

This file is React/native and not unit-tested in this repo (consistent with its current state). Gate on `tsc`; correctness of the prune logic is covered by Task 2's `deleteProgressByIds` test. Device-verified later.

- [ ] **Step 1: Add the import**

In `src/library/library-provider.tsx`, extend the existing progress/videos-repo imports. It currently imports from `@/db/videos-repo`; add a `deleteProgressByIds` import:

```ts
import { deleteProgressByIds } from '@/db/progress-repo';
```

- [ ] **Step 2: Prune in the reconcile block**

In the background-scan effect, the code computes `removed` and calls `deleteVideosByIds`. Update that block so the progress rows are pruned alongside:

```ts
        await upsertVideos(db, scanned);
        if (removed.length) {
          await deleteVideosByIds(db, removed);
          await deleteProgressByIds(db, removed);
        }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no output).

- [ ] **Step 4: Run the full suite to confirm nothing regressed**

Run: `npm test`
Expected: PASS (all existing + new tests).

- [ ] **Step 5: Commit**

```bash
git add src/library/library-provider.tsx
git commit -m "feat(library): cascade-prune watch_progress for removed videos"
```

---

### Task 6: `HistoryRow` component (swipeable)

**Files:**
- Create: `src/components/history-row.tsx`

**Interfaces:**
- Consumes: `VideoThumbnail`, `DurationBadge`, `ProgressBar`, `PressableScale`, `useTheme`; `LibraryVideo` type.
- Produces: `HistoryRow({ video, percent, onPress, onRemove })` — a swipeable row (swipe left reveals a red delete action calling `onRemove`); body tap calls `onPress`. Thumbnail carries the duration badge and an overlaid progress bar along its bottom edge; filename + folder on the right.

No Jest test (UI). Gate on `tsc`; device-verified later.

- [ ] **Step 1: Create `src/components/history-row.tsx`**

```tsx
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const HistoryRow = memo(function HistoryRow({
  video,
  percent,
  onPress,
  onRemove,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={onRemove}
          style={[styles.remove, { backgroundColor: colors.error ?? '#B00020' }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.onError ?? '#fff'} />
        </Pressable>
      )}
    >
      <PressableScale
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.background,
          borderRadius: radius.md,
        }}
      >
        <View>
          <VideoThumbnail video={video} style={styles.thumb} />
          <DurationBadge ms={video.durationMs} />
          <View style={styles.progress}>
            <ProgressBar percent={percent} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>
            {video.filename}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12, marginTop: 2 }}
          >
            {video.folder}
          </Text>
        </View>
      </PressableScale>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  thumb: { width: 110, height: 64 },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '500' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/history-row.tsx
git commit -m "feat(history): swipeable HistoryRow component"
```

---

### Task 7: History screen (`/history`)

**Files:**
- Create: `src/app/history.tsx`

**Interfaces:**
- Consumes: `getHistory`, `removeHistory`, `clearHistory` (`@/db/history-repo`); `assembleHistory`, `filterHistory` (`@/history/assemble-history`); `useLibraryData` (`@/library/library-provider`); `HistoryRow`, `SearchBar`, `Screen`, `useTheme`.
- Produces: default-exported `HistoryScreen` route at `/history`.

Loads history on focus, joins against the cached library, renders day-sectioned swipeable rows with live search, a Clear-all header action (confirm), tap-to-resume, and an empty state. No Jest test (UI); gate on `tsc`, device-verified later.

- [ ] **Step 1: Create `src/app/history.tsx`**

```tsx
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { HistoryRow } from '@/components/history-row';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { clearHistory, getHistory, removeHistory, type HistoryRow as HistoryRowData } from '@/db/history-repo';
import { assembleHistory, filterHistory } from '@/history/assemble-history';
import type { HistoryItem } from '@/history/types';
import { useLibraryData } from '@/library/library-provider';
import { useTheme } from '@/theme/theme-provider';

export default function HistoryScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();
  const [rows, setRows] = useState<HistoryRowData[]>([]);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    getHistory(db).then(setRows);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sections = useMemo(
    () => filterHistory(assembleHistory(rows, videos, Date.now()), query),
    [rows, videos, query],
  );

  const onRemove = useCallback(
    (videoId: string) => {
      setRows((prev) => prev.filter((r) => r.videoId !== videoId));
      removeHistory(db, videoId);
    },
    [db],
  );

  const onClearAll = useCallback(() => {
    if (rows.length === 0) return;
    Alert.alert('Clear watch history', 'Remove every video from your history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          setRows([]);
          clearHistory(db);
        },
      },
    ]);
  }, [db, rows.length]);

  const openVideo = useCallback(
    (item: HistoryItem) => {
      const v = item.video;
      router.push({ pathname: '/player', params: { videoId: v.id, uri: v.uri, title: v.filename } });
    },
    [router],
  );

  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={[styles.title, { color: colors.onSurface }]}>History</Text>
        </View>
        <Pressable onPress={onClearAll} hitSlop={10}>
          <Ionicons name="trash-outline" size={22} color={colors.onSurface} />
        </Pressable>
      </View>

      <View style={{ marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.video.id}
        renderItem={({ item }) => (
          <HistoryRow
            video={item.video}
            percent={item.percent}
            onPress={() => openVideo(item)}
            onRemove={() => onRemove(item.video.id)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.section, { color: colors.onSurface, backgroundColor: colors.background }]}>
            {section.title}
          </Text>
        )}
        stickySectionHeadersEnabled
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="time-outline" size={64} color={colors.onSurfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No watch history yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8 }}>
              Videos you play will show up here.
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        bounces
        overScrollMode="always"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  section: { fontSize: 14, fontWeight: '700', paddingVertical: 8 },
});
```

> Note: `useFocusEffect` is exported from `expo-router` (re-export of the React Navigation hook), matching its use in `src/app/index.tsx`. `Date.now()` is fine in app code (the no-`Date.now` rule applies only to Workflow scripts).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. If it complains that `/history` is not a known route, that's the typed-routes cache (`.expo/types/router.d.ts`) — it regenerates when the user runs `expo start`; the route file existing is what matters. Verify no other errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/history.tsx
git commit -m "feat(history): day-sectioned, searchable history screen"
```

---

### Task 8: Home header entry button → `/history`

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: the existing `Link`/`router` already imported in `index.tsx`; new route `/history` (Task 7).
- Produces: a history icon button in the home header pill that navigates to `/history`.

UI change; gate on `tsc`, device-verified later.

- [ ] **Step 1: Add the history button to the header pill**

In `src/app/index.tsx`, the header pill `View` contains `SortButton`, `LayoutToggle`, and the settings `Link`. Add a history `Link` before the settings link:

```tsx
          <SortButton sortKey={sortKey} sortDir={sortDir} onPress={() => setSortOpen(true)} />
          <LayoutToggle value={layout} onChange={onLayout} />
          <Link href="/history" style={{ padding: 4 }}>
            <Ionicons name="time-outline" size={20} color={colors.onSurface} />
          </Link>
          <Link href="/settings" style={{ padding: 4 }}>
            <Ionicons name="settings-outline" size={20} color={colors.onSurface} />
          </Link>
```

(`Link` and `Ionicons` are already imported in this file.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (modulo the typed-routes cache note from Task 7 — resolves on `expo start`).

- [ ] **Step 3: Full test suite + commit**

```bash
npm test
git add src/app/index.tsx
git commit -m "feat(history): add history button to home header"
```

---

## Final verification (whole feature)

- [ ] `npm test` — all suites pass (schema, history-repo, bucket-day, assemble-history + existing 82).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `git log --oneline` shows plain commits, no `Co-Authored-By` trailer.
- [ ] **Hand to user for device verification** (`npx expo start`, no native rebuild needed):
  - History button appears in the home header; opens the History screen.
  - Played videos appear newest-first under Today / Yesterday / dated sections.
  - Search filters by filename; clear button works.
  - Each row shows thumbnail, duration badge, progress bar, filename + folder.
  - Tap a row → player opens and resumes at saved position.
  - Swipe a row → red delete action removes just that entry (and persists across reopen).
  - Clear-all (header trash) → confirm → empties history; empty state shows.
  - Delete a video from the device, reopen the app → it's gone from History (display filter), and a rescan prunes its progress row (no orphan resurfacing).

## Spec coverage check

- Entry point button → Task 8. Screen + day sections + search + rows/progress → Task 7 (+ Task 6 row, Task 3/4 helpers). Swipe-remove + clear-all → Tasks 6/7. Deleted-media display filter → Task 4 (`assembleHistory` drop) + Task 7. Deleted-media prune → Tasks 2 + 5. Index/migration → Task 1. Repos → Task 2. All spec sections mapped.
