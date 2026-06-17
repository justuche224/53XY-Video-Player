# Library Phase B — UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase-A grouping data into the real, beautiful library UI: an adaptive grid/list of poster cards, Videos/Folders tabs, search, a group-detail screen, lazy cached thumbnails, resume progress bars, and tasteful Material You animation.

**Architecture:** New presentational components consume the existing `useLibrary`/grouping engine; a read-only `useGroups` hook lets the detail screen re-group from SQLite without re-scanning. Thumbnails are generated lazily per video and cached in a new `videos.thumb_uri` column (migration v2). Pure UI helpers (search filter, episode label, concurrency limiter) are unit-tested; components/screens are device-verified. No new native dependencies — `FlatList`, `expo-image`, and `expo-video-thumbnails` are already in the dev client, so Phase B is JS-only (no rebuild).

**Tech Stack:** Expo SDK 56, expo-router (typed routes), expo-image, expo-video-thumbnails, expo-sqlite, react-native-reanimated + gesture-handler, React 19, TypeScript, Jest.

## Design (approved 2026-06-17)
- **Library screen**: top bar (title · search · grid/list toggle · Settings); **Videos | Folders** segmented tabs → `useLibrary('name'|'folder')`; grid or list of groups. Active tab + layout persisted in the `settings` table.
- **Grid**: 2-col poster `GroupCard` (thumbnail, title, "N videos", thin progress bar). **List**: `GroupRow` (thumb left, title + count + progress). Toggle remembered.
- **Tap**: group with >1 video → group detail; **single-video group → straight to the player**.
- **Group detail**: `EpisodeRow` list (thumb, episode label, filename, duration, progress) → tap plays.
- **Search**: filters current groups by title, instant/client-side.
- **Thumbnails**: lazy per video, cached in `thumb_uri`, concurrency-capped, shown via `expo-image`.
- **Progress bars**: from `watch_progress` (empty until the Player plan writes it — wired now).
- **Motion**: tasteful — card press-scale, smooth detail transition, gentle list fade-in.
- **Player**: a thin placeholder route in Phase B (real gesture player is Plan 3).

## Global Constraints
- **Read docs first** (`AGENTS.md`): https://docs.expo.dev/versions/v56.0.0/. APIs used here verified this session: `expo-image` `Image` props (`source`, `contentFit`, `transition`, `recyclingKey`, `cachePolicy`); `expo-video-thumbnails` `getThumbnailAsync(uri, { time, quality })` → `{ uri, width, height }`.
- **No new native dependencies** — Phase B is JS-only; use built-in `FlatList`, already-installed `expo-image`/`expo-video-thumbnails`. (Avoids a native rebuild.)
- **Platform:** Android-only. **Path alias:** `@/*` → `./src/*`. **DB:** `p53xy.db`.
- **Pure-logic test rule:** modules under `src/library/` (helpers) MUST NOT import native/Expo modules. Components/screens/hooks/thumbnail-service are device-verified, not unit-tested.
- **Commit-message rule (user override):** NO `Co-Authored-By:` / "Generated with" trailers.
- **Reuse Phase A:** `useLibrary(mode)`, `groupByName`/`groupByFolder`, `LibraryVideo`/`Group`/`EpisodeInfo` (`@/library/types`), `parseEpisode`, `getAllVideos`/`upsertVideos`, `computeProgressPercent`, `useTheme` (`colors`, `spacing`, `radius`).
- **Navigation:** group detail is a static route `app/group.tsx` reading **query params** `key` + `mode` (NOT a `[id]` dynamic segment — group keys contain `/` for folders). Player is `app/player.tsx` reading `videoId`/`uri`/`title` params.
- **Shared new types (Task 1 & 3):** `LibraryVideo` gains `thumbUri: string | null`. `interface ProgressEntry { positionMs: number; percent: number }`; `type ProgressMap = Map<string, ProgressEntry>`.

---

### Task 1: Schema v2 (thumb_uri) + row mapping (TDD)

Add a cached-thumbnail column and thread it through the `LibraryVideo`/`VideoRow` mapping, preserving it across re-scans.

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/library/types.ts`
- Modify: `src/db/video-row.ts`
- Modify: `src/db/videos-repo.ts`
- Modify: `src/db/__tests__/video-row.test.ts`

**Interfaces:**
- Consumes: `runMigrations`/`Migration` (Foundation).
- Produces: `videos.thumb_uri TEXT` column; `LATEST_VERSION = 2`; `LibraryVideo.thumbUri: string | null`; `VideoRow.thumb_uri`; `setThumbUri(db, id, uri): Promise<void>`; `upsertVideos` inserts `thumb_uri` but PRESERVES it on conflict.

- [ ] **Step 1: Add migration v2 to `src/db/schema.ts`**

Append to the `MIGRATIONS` array and bump the version constant:

```ts
  {
    version: 2,
    up: `ALTER TABLE videos ADD COLUMN thumb_uri TEXT;`,
  },
];

export const LATEST_VERSION = 2;
```

- [ ] **Step 2: Add `thumbUri` to `LibraryVideo` in `src/library/types.ts`**

Add the field (after `folder`):

```ts
  folder: string;
  thumbUri: string | null;
```

- [ ] **Step 3: Update the failing row test in `src/db/__tests__/video-row.test.ts`**

Add `thumbUri` to the sample and expected row, and a preservation note. Replace the `sample` object and the two assertions:

```ts
const sample: LibraryVideo = {
  id: 'content://media/external/video/media/42',
  uri: 'file:///storage/emulated/0/Movies/Banshee/e1.mkv',
  filename: 'Banshee S01E01 GalaxyTV.mkv',
  durationMs: 3540000,
  width: 1280,
  height: 720,
  folder: '/storage/emulated/0/Movies/Banshee',
  thumbUri: 'file:///cache/thumb-42.jpg',
  createdAt: 111,
  modifiedAt: 222,
};

describe('video-row mapping', () => {
  it('maps LibraryVideo to a snake_case row', () => {
    const row = toVideoRow(sample);
    expect(row).toEqual({
      id: sample.id,
      uri: sample.uri,
      filename: sample.filename,
      duration_ms: 3540000,
      size_bytes: null,
      width: 1280,
      height: 720,
      folder: sample.folder,
      thumb_uri: 'file:///cache/thumb-42.jpg',
      modified_at: 222,
      created_at: 111,
    });
  });

  it('round-trips back to LibraryVideo', () => {
    expect(fromVideoRow(toVideoRow(sample))).toEqual(sample);
  });
});
```

- [ ] **Step 4: Run test — verify it fails**

Run: `npm test -- video-row`
Expected: FAIL (missing `thumb_uri`/`thumbUri`).

- [ ] **Step 5: Update `src/db/video-row.ts`**

Add `thumb_uri` to `VideoRow`, and map it in both directions:

```ts
export interface VideoRow {
  id: string;
  uri: string;
  filename: string;
  duration_ms: number | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  thumb_uri: string | null;
  modified_at: number | null;
  created_at: number | null;
}
```

In `toVideoRow`, add after `folder: v.folder,`: `thumb_uri: v.thumbUri,`.
In `fromVideoRow`, add after `folder: r.folder,`: `thumbUri: r.thumb_uri,`.

- [ ] **Step 6: Run test — verify it passes**

Run: `npm test -- video-row`
Expected: PASS, 2 tests.

- [ ] **Step 7: Update `src/db/videos-repo.ts`**

(a) Add `thumb_uri` to the INSERT column list + a `?`, and append `r.thumb_uri` to the bind array (after `r.folder`). Do NOT add `thumb_uri` to the `ON CONFLICT DO UPDATE SET` clause (preserve the cached thumbnail across re-scans). The INSERT column order must be: `id, uri, filename, duration_ms, size_bytes, width, height, folder, thumb_uri, modified_at, created_at` with 11 `?` and the bind array `[r.id, r.uri, r.filename, r.duration_ms, r.size_bytes, r.width, r.height, r.folder, r.thumb_uri, r.modified_at, r.created_at]`.

(b) Add a setter at the end of the file:

```ts
export async function setThumbUri(db: SQLiteDatabase, id: string, uri: string): Promise<void> {
  await db.runAsync('UPDATE videos SET thumb_uri = ? WHERE id = ?', [uri, id]);
}
```

- [ ] **Step 8: Update the scanner mapping** in `src/media/media-scanner.ts` — add `thumbUri: null,` to the pushed object (after `folder: deriveFolder(info.uri).path,`) so scanned videos satisfy `LibraryVideo`.

- [ ] **Step 9: Typecheck + full test**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites pass (video-row still 2; others unchanged).

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts src/library/types.ts src/db/video-row.ts src/db/videos-repo.ts src/db/__tests__/video-row.test.ts src/media/media-scanner.ts
git commit -m "feat: add cached thumb_uri column (migration v2) and thread through repo"
```

---

### Task 2: Pure UI helpers (TDD)

Search filtering, episode-label formatting, and an async concurrency limiter for thumbnail generation. All pure.

**Files:**
- Create: `src/library/filter-groups.ts`
- Create: `src/library/episode-label.ts`
- Create: `src/lib/p-limit.ts`
- Test: `src/library/__tests__/filter-groups.test.ts`
- Test: `src/library/__tests__/episode-label.test.ts`
- Test: `src/lib/__tests__/p-limit.test.ts`

**Interfaces:**
- Consumes: `Group` (`@/library/types`).
- Produces:
  - `filterGroups(groups: Group[], query: string): Group[]` — case-insensitive substring match on `title`; empty/whitespace query returns all groups unchanged.
  - `formatEpisodeLabel(season: number | null, episode: number | null): string` — `S01E02`, or `S01` (episode null), or `''` (season null). Zero-padded to 2 digits.
  - `pLimit(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T>` — caps concurrent in-flight calls.

- [ ] **Step 1: Write the failing tests**

```ts
// src/library/__tests__/filter-groups.test.ts
import { filterGroups } from '../filter-groups';
import type { Group } from '../types';

const g = (title: string): Group => ({ key: title.toLowerCase(), title, kind: 'name', items: [], count: 0 });

describe('filterGroups', () => {
  const groups = [g('Banshee'), g('Boston Legal'), g('Citadel')];
  it('returns all groups for an empty/whitespace query', () => {
    expect(filterGroups(groups, '')).toBe(groups);
    expect(filterGroups(groups, '   ')).toBe(groups);
  });
  it('matches case-insensitive substrings of the title', () => {
    expect(filterGroups(groups, 'bo').map((x) => x.title)).toEqual(['Boston Legal']);
    expect(filterGroups(groups, 'e').map((x) => x.title)).toEqual(['Banshee', 'Citadel']);
  });
  it('returns empty when nothing matches', () => {
    expect(filterGroups(groups, 'zzz')).toEqual([]);
  });
});
```

```ts
// src/library/__tests__/episode-label.test.ts
import { formatEpisodeLabel } from '../episode-label';

describe('formatEpisodeLabel', () => {
  it('formats season+episode zero-padded', () => {
    expect(formatEpisodeLabel(1, 2)).toBe('S01E02');
    expect(formatEpisodeLabel(12, 134)).toBe('S12E134');
  });
  it('formats season-only', () => {
    expect(formatEpisodeLabel(1, null)).toBe('S01');
  });
  it('returns empty when season is null', () => {
    expect(formatEpisodeLabel(null, null)).toBe('');
    expect(formatEpisodeLabel(null, 5)).toBe('');
  });
});
```

```ts
// src/lib/__tests__/p-limit.test.ts
import { pLimit } from '../p-limit';

describe('pLimit', () => {
  it('never exceeds the concurrency cap and returns results', async () => {
    const limit = pLimit(2);
    let active = 0;
    let maxActive = 0;
    const task = () =>
      limit(async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return 'ok';
      });
    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    expect(maxActive).toBeLessThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npm test -- filter-groups episode-label p-limit`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// src/library/filter-groups.ts
import type { Group } from './types';

export function filterGroups(groups: Group[], query: string): Group[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => g.title.toLowerCase().includes(q));
}
```

```ts
// src/library/episode-label.ts
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatEpisodeLabel(season: number | null, episode: number | null): string {
  if (season === null) return '';
  return episode === null ? `S${pad2(season)}` : `S${pad2(season)}E${pad2(episode)}`;
}
```

```ts
// src/lib/p-limit.ts
export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        active++;
        fn().then(resolve, reject).finally(next);
      };
      if (active < concurrency) start();
      else queue.push(start);
    });
  };
}
```

- [ ] **Step 4: Run tests — verify pass**

Run: `npm test -- filter-groups episode-label p-limit`
Expected: PASS (filter-groups 3, episode-label 3, p-limit 1).

- [ ] **Step 5: Commit**

```bash
git add src/library/filter-groups.ts src/library/episode-label.ts src/lib/p-limit.ts src/library/__tests__/filter-groups.test.ts src/library/__tests__/episode-label.test.ts src/lib/__tests__/p-limit.test.ts
git commit -m "feat: pure UI helpers — group search filter, episode label, concurrency limiter"
```

---

### Task 3: Read-only grouping hook + progress + settings repos

Data plumbing for the screens: read+group without scanning (for detail), a watch-progress map, and persisted layout/tab settings.

**Files:**
- Create: `src/library/use-groups.ts`
- Create: `src/db/progress-repo.ts`
- Create: `src/db/settings-repo.ts`

**Interfaces:**
- Consumes: `getAllVideos` (`@/db/videos-repo`), `groupByName`/`groupByFolder` (`@/library/group-videos`), `useSQLiteContext` (expo-sqlite), `computeProgressPercent` (`@/db/progress`).
- Produces:
  - `interface ProgressEntry { positionMs: number; percent: number }`; `type ProgressMap = Map<string, ProgressEntry>`.
  - `getProgressMap(db): Promise<ProgressMap>` (keyed by `video_id`).
  - `getSetting(db, key): Promise<string | null>`; `setSetting(db, key, value): Promise<void>`.
  - `useGroups(mode: 'name' | 'folder'): { groups: Group[]; loading: boolean; reload: () => void }` — reads `getAllVideos` (NO scan) and groups by `mode`; `reload()` re-reads.

- [ ] **Step 1: progress repo**

```ts
// src/db/progress-repo.ts
import type { SQLiteDatabase } from 'expo-sqlite';

export interface ProgressEntry {
  positionMs: number;
  percent: number;
}
export type ProgressMap = Map<string, ProgressEntry>;

interface ProgressRow {
  video_id: string;
  position_ms: number;
  percent: number;
}

export async function getProgressMap(db: SQLiteDatabase): Promise<ProgressMap> {
  const rows = await db.getAllAsync<ProgressRow>(
    'SELECT video_id, position_ms, percent FROM watch_progress',
  );
  const map: ProgressMap = new Map();
  for (const r of rows) map.set(r.video_id, { positionMs: r.position_ms, percent: r.percent });
  return map;
}
```

- [ ] **Step 2: settings repo**

```ts
// src/db/settings-repo.ts
import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}
```

- [ ] **Step 3: read-only grouping hook**

```ts
// src/library/use-groups.ts
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
```

- [ ] **Step 4: Typecheck + test**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites still green (no new unit tests this task — repos/hook are device-verified).

- [ ] **Step 5: Commit**

```bash
git add src/library/use-groups.ts src/db/progress-repo.ts src/db/settings-repo.ts
git commit -m "feat: read-only useGroups hook, progress map and settings repos"
```

---

### Task 4: Thumbnail service (native, device-verified)

Lazily generate a thumbnail per video and cache its uri in `thumb_uri`, capped for concurrency.

**Files:**
- Create: `src/media/thumbnails.ts`

**Interfaces:**
- Consumes: `getThumbnailAsync` (expo-video-thumbnails), `setThumbUri` (`@/db/videos-repo`), `pLimit` (`@/lib/p-limit`), `LibraryVideo` (`@/library/types`), `SQLiteDatabase`.
- Produces: `getOrCreateThumbnail(db, video): Promise<string | null>` — returns `video.thumbUri` if already set; else generates at 3000ms / quality 0.7, persists via `setThumbUri`, returns the new uri; returns `null` on failure. Generation is globally concurrency-capped at 3.

- [ ] **Step 1: Docs check** — confirm `getThumbnailAsync(sourceFilename, { time, quality })` returns `{ uri }` (verified this session; re-check `node_modules/expo-video-thumbnails` types if unsure).

- [ ] **Step 2: Implement**

```ts
// src/media/thumbnails.ts
import { getThumbnailAsync } from 'expo-video-thumbnails';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { LibraryVideo } from '@/library/types';
import { setThumbUri } from '@/db/videos-repo';
import { pLimit } from '@/lib/p-limit';

const limit = pLimit(3);

export async function getOrCreateThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
): Promise<string | null> {
  if (video.thumbUri) return video.thumbUri;
  return limit(async () => {
    try {
      const { uri } = await getThumbnailAsync(video.uri, { time: 3000, quality: 0.7 });
      await setThumbUri(db, video.id, uri);
      return uri;
    } catch {
      return null;
    }
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/media/thumbnails.ts
git commit -m "feat: lazy cached thumbnail generation service"
```

---

### Task 5: Presentational components (device-verified)

The visual building blocks: progress bar, thumbnail image, grid card, list row, episode row — themed, with press-scale animation on tappables.

**Files:**
- Create: `src/components/progress-bar.tsx`
- Create: `src/components/video-thumbnail.tsx`
- Create: `src/components/pressable-scale.tsx`
- Create: `src/components/group-card.tsx`
- Create: `src/components/group-row.tsx`
- Create: `src/components/episode-row.tsx`

**Interfaces:**
- Consumes: `useTheme` (`colors`/`spacing`/`radius`); `getOrCreateThumbnail` (Task 4); `useSQLiteContext`; `Group`/`LibraryVideo` (`@/library/types`); `parseEpisode` + `formatEpisodeLabel`; `Image` from `expo-image`; Reanimated.
- Produces:
  - `ProgressBar({ percent }: { percent: number })`
  - `VideoThumbnail({ video, style }: { video: LibraryVideo; style?: StyleProp<ViewStyle> })` — lazy-loads via `getOrCreateThumbnail`, themed placeholder until ready.
  - `PressableScale({ onPress, children, style })` — wraps children, scales to ~0.96 while pressed (Reanimated spring).
  - `GroupCard({ group, percent, onPress })` (grid), `GroupRow({ group, percent, onPress })` (list), `EpisodeRow({ video, percent, onPress })`.

- [ ] **Step 1: ProgressBar**

```tsx
// src/components/progress-bar.tsx
import { View } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function ProgressBar({ percent }: { percent: number }) {
  const { colors } = useTheme();
  if (percent <= 0) return null;
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: colors.surfaceVariant ?? '#333', overflow: 'hidden' }}>
      <View style={{ height: 3, width: `${Math.min(100, percent * 100)}%`, backgroundColor: colors.primary }} />
    </View>
  );
}
```

- [ ] **Step 2: PressableScale**

```tsx
// src/components/pressable-scale.tsx
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  onPress,
  children,
  style,
}: {
  onPress: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => (scale.value = withSpring(0.96, { damping: 18, stiffness: 240 }))}
      onPressOut={() => (scale.value = withSpring(1, { damping: 18, stiffness: 240 }))}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
```

- [ ] **Step 3: VideoThumbnail**

```tsx
// src/components/video-thumbnail.tsx
import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { getOrCreateThumbnail } from '@/media/thumbnails';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function VideoThumbnail({ video, style }: { video: LibraryVideo; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme();
  const [uri, setUri] = useState<string | null>(video.thumbUri);
  const db = useSQLiteContext();

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      getOrCreateThumbnail(db, video).then((u) => {
        if (!cancelled && u) setUri(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [db, video, uri]);

  return (
    <View style={[{ backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.md, overflow: 'hidden' }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          recyclingKey={video.id}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
```

- [ ] **Step 4: GroupCard (grid)**

```tsx
// src/components/group-card.tsx
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function GroupCard({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flex: 1, margin: spacing.sm }}>
      <VideoThumbnail video={group.items[0]} style={styles.thumb} />
      <View style={{ marginTop: spacing.sm }}>
        <ProgressBar percent={percent} />
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface, marginTop: spacing.xs }]}>
          {group.title}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12 }}>
          {group.count} video{group.count === 1 ? '' : 's'}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  thumb: { width: '100%', aspectRatio: 16 / 10 },
  title: { fontSize: 15, fontWeight: '600' },
});
```

- [ ] **Step 5: GroupRow (list)**

```tsx
// src/components/group-row.tsx
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function GroupRow({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md }}>
      <VideoThumbnail video={group.items[0]} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{group.title}</Text>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12, marginBottom: 4 }}>
          {group.count} video{group.count === 1 ? '' : 's'}
        </Text>
        <ProgressBar percent={percent} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 60 },
  title: { fontSize: 16, fontWeight: '600' },
});
```

- [ ] **Step 6: EpisodeRow**

```tsx
// src/components/episode-row.tsx
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function EpisodeRow({ video, percent, onPress }: { video: LibraryVideo; percent: number; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md }}>
      <VideoThumbnail video={video} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        {label ? <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{label}</Text> : null}
        <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{video.filename}</Text>
        <View style={{ marginTop: 4 }}><ProgressBar percent={percent} /></View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 110, height: 64 },
  title: { fontSize: 14, fontWeight: '500' },
});
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/progress-bar.tsx src/components/pressable-scale.tsx src/components/video-thumbnail.tsx src/components/group-card.tsx src/components/group-row.tsx src/components/episode-row.tsx
git commit -m "feat: library presentational components (cards, rows, thumbnail, progress, press-scale)"
```

---

### Task 6: Library controls (device-verified)

The header controls: segmented Videos/Folders tabs, grid/list toggle, and a search bar.

**Files:**
- Create: `src/components/segmented-tabs.tsx`
- Create: `src/components/layout-toggle.tsx`
- Create: `src/components/search-bar.tsx`

**Interfaces:**
- Consumes: `useTheme`.
- Produces:
  - `SegmentedTabs({ value, onChange }: { value: 'name' | 'folder'; onChange: (v: 'name' | 'folder') => void })` — two pills "Videos"/"Folders".
  - `LayoutToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void })` — icon button toggling layout.
  - `SearchBar({ value, onChangeText }: { value: string; onChangeText: (t: string) => void })`.

- [ ] **Step 1: SegmentedTabs**

```tsx
// src/components/segmented-tabs.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

const OPTIONS: { key: 'name' | 'folder'; label: string }[] = [
  { key: 'name', label: 'Videos' },
  { key: 'folder', label: 'Folders' },
];

export function SegmentedTabs({ value, onChange }: { value: 'name' | 'folder'; onChange: (v: 'name' | 'folder') => void }) {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.pill, { borderRadius: radius.pill, backgroundColor: active ? colors.primary : 'transparent' }]}>
            <Text style={{ color: active ? (colors.onPrimary ?? '#fff') : colors.onSurface, fontWeight: '600' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 3, alignSelf: 'flex-start' },
  pill: { paddingHorizontal: 16, paddingVertical: 6 },
});
```

- [ ] **Step 2: LayoutToggle**

```tsx
// src/components/layout-toggle.tsx
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function LayoutToggle({ value, onChange }: { value: 'grid' | 'list'; onChange: (v: 'grid' | 'list') => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={() => onChange(value === 'grid' ? 'list' : 'grid')} hitSlop={10}>
      <Text style={{ color: colors.onSurface, fontSize: 20 }}>{value === 'grid' ? '☰' : '▦'}</Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: SearchBar**

```tsx
// src/components/search-bar.tsx
import { StyleSheet, TextInput } from 'react-native';
import { useTheme } from '@/theme/theme-provider';

export function SearchBar({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const { colors, radius } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder="Search"
      placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
      style={[styles.input, { backgroundColor: colors.surfaceVariant ?? '#222', color: colors.onSurface, borderRadius: radius.md }]}
    />
  );
}

const styles = StyleSheet.create({
  input: { paddingHorizontal: 14, paddingVertical: 8, fontSize: 15 },
});
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` (expected clean), then:

```bash
git add src/components/segmented-tabs.tsx src/components/layout-toggle.tsx src/components/search-bar.tsx
git commit -m "feat: library controls — segmented tabs, layout toggle, search bar"
```

---

### Task 7: Library screen (device-verified)

Assemble the real library: scan via `useLibrary`, persist tab+layout, render the adaptive grid/list with search and progress, and navigate on tap.

**Files:**
- Modify: `src/app/index.tsx` (replace the Phase-A debug render)

**Interfaces:**
- Consumes: `useLibrary` (Phase A), `useGroups`-not-needed-here, `getProgressMap`/`ProgressMap` (Task 3), `getSetting`/`setSetting` (Task 3), `filterGroups` (Task 2), `GroupCard`/`GroupRow`/`SegmentedTabs`/`LayoutToggle`/`SearchBar` (Tasks 5–6), `useSQLiteContext`, `useRouter` (expo-router), `Screen`, `useTheme`, `computeProgressPercent`.
- Produces: the Library route. Tap → `router.push({ pathname: '/group', params: { key, mode } })` when `count > 1`, else `router.push({ pathname: '/player', params: { videoId, uri, title } })` with the single item.

- [ ] **Step 1: Implement the Library screen**

```tsx
// src/app/index.tsx
import { Link, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { GroupCard } from '@/components/group-card';
import { GroupRow } from '@/components/group-row';
import { LayoutToggle } from '@/components/layout-toggle';
import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { computeProgressPercent } from '@/db/progress';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { getSetting, setSetting } from '@/db/settings-repo';
import { filterGroups } from '@/library/filter-groups';
import { useLibrary } from '@/library/use-library';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

type Mode = 'name' | 'folder';
type Layout = 'grid' | 'list';

function groupPercent(group: Group, progress: ProgressMap): number {
  // Show the most-recently-watched item's progress on the group.
  let best = 0;
  for (const item of group.items) {
    const p = progress.get(item.id);
    if (p && p.percent > 0 && p.percent < 0.99) best = Math.max(best, p.percent);
  }
  return best;
}

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('name');
  const [layout, setLayout] = useState<Layout>('grid');
  const [query, setQuery] = useState('');
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const { status, groups } = useLibrary(mode);

  useEffect(() => {
    getSetting(db, 'mode').then((v) => v === 'folder' && setMode('folder'));
    getSetting(db, 'layout').then((v) => v === 'list' && setLayout('list'));
  }, [db]);

  useEffect(() => {
    if (status === 'ready') getProgressMap(db).then(setProgress);
  }, [db, status]);

  const onMode = useCallback((v: Mode) => { setMode(v); setSetting(db, 'mode', v); }, [db]);
  const onLayout = useCallback((v: Layout) => { setLayout(v); setSetting(db, 'layout', v); }, [db]);

  const visible = useMemo(() => filterGroups(groups, query), [groups, query]);

  const openGroup = useCallback((group: Group) => {
    if (group.count === 1) {
      const v = group.items[0];
      router.push({ pathname: '/player', params: { videoId: v.id, uri: v.uri, title: v.filename } });
    } else {
      router.push({ pathname: '/group', params: { key: group.key, mode } });
    }
  }, [router, mode]);

  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <LayoutToggle value={layout} onChange={onLayout} />
          <Link href="/settings" style={{ color: colors.primary, fontWeight: '600' }}>Settings</Link>
        </View>
      </View>
      <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
        <SegmentedTabs value={mode} onChange={onMode} />
      </View>
      {status === 'denied' ? (
        <Text style={{ color: colors.onSurface }}>Media permission denied. Enable it in system settings.</Text>
      ) : (
        <FlatList
          key={layout}
          data={visible}
          keyExtractor={(g) => g.key}
          numColumns={layout === 'grid' ? 2 : 1}
          renderItem={({ item }) =>
            layout === 'grid' ? (
              <GroupCard group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
            ) : (
              <GroupRow group={item} percent={groupPercent(item, progress)} onPress={() => openGroup(item)} />
            )
          }
          ListEmptyComponent={
            <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
              {status === 'ready' ? 'No videos found.' : 'Loading…'}
            </Text>
          }
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
});
```

- [ ] **Step 2: Typecheck + full test**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites green.

- [ ] **Step 3: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat: adaptive library screen — grid/list, tabs, search, persisted settings"
```

---

### Task 8: Group detail + Player placeholder (device-verified)

The episode-list detail screen and a thin player placeholder so navigation is end-to-end.

**Files:**
- Create: `src/app/group.tsx`
- Create: `src/app/player.tsx`

**Interfaces:**
- Consumes: `useGroups` (Task 3), `getProgressMap`/`ProgressMap` (Task 3), `EpisodeRow` (Task 5), `useLocalSearchParams`/`useRouter`/`Stack` (expo-router), `useSQLiteContext`, `Screen`, `useTheme`.
- Produces: `/group` route (params `key`, `mode`) and `/player` route (params `videoId`, `uri`, `title`).

- [ ] **Step 1: Group detail screen**

```tsx
// src/app/group.tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Text } from 'react-native';

import { EpisodeRow } from '@/components/episode-row';
import { Screen } from '@/components/screen';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { useGroups } from '@/library/use-groups';
import { useTheme } from '@/theme/theme-provider';

export default function GroupDetailScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { key, mode } = useLocalSearchParams<{ key: string; mode: 'name' | 'folder' }>();
  const { groups } = useGroups(mode === 'folder' ? 'folder' : 'name');
  const [progress, setProgress] = useState<ProgressMap>(new Map());

  useEffect(() => { getProgressMap(db).then(setProgress); }, [db]);

  const group = useMemo(() => groups.find((g) => g.key === key), [groups, key]);

  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: group?.title ?? 'Group' }} />
      <FlatList
        data={group?.items ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <EpisodeRow
            video={item}
            percent={progress.get(item.id)?.percent ?? 0}
            onPress={() => router.push({ pathname: '/player', params: { videoId: item.id, uri: item.uri, title: item.filename } })}
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.onSurface }}>Loading…</Text>}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Player placeholder screen**

```tsx
// src/app/player.tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function PlayerScreen() {
  const { colors } = useTheme();
  const { title } = useLocalSearchParams<{ videoId: string; uri: string; title: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Player' }} />
      <View style={styles.center}>
        <Text style={{ color: colors.onSurface, fontSize: 16, textAlign: 'center' }}>
          ▶ Player coming in Plan 3{'\n'}{title}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
```

- [ ] **Step 3: Typecheck + full test**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites green.

- [ ] **Step 4: DEVICE VERIFICATION** (reload — no rebuild needed)

Run: `npx expo start` then reload. Manual checklist:
- [ ] Library shows a 2-col grid of cards with thumbnails generating in, titles, and "N videos".
- [ ] Grid/list toggle switches layout and persists across relaunch; Videos/Folders tabs switch grouping and persist.
- [ ] Search filters groups live.
- [ ] Tapping a multi-video group opens the episode list; tapping an episode opens the player placeholder. Tapping a single-video group goes straight to the player placeholder.
- [ ] Progress bars are absent (expected — no watch data until Plan 3); no crashes.
- [ ] Thumbnails persist on relaunch (cached, no regeneration flicker).

- [ ] **Step 5: Commit**

```bash
git add src/app/group.tsx src/app/player.tsx
git commit -m "feat: group detail screen and player placeholder route"
```

---

## Definition of Done (Library Phase B)
- `npm test` green (Phase A 38 + filter-groups 3 + episode-label 3 + p-limit 1 = 45).
- `npx tsc --noEmit` clean.
- On device: adaptive grid/list library with thumbnails, tabs, search, and working navigation to group detail + player placeholder; settings persist; migration v2 applied.

## Notes for Plan 3 (Player)
- Replace `src/app/player.tsx` with the real `expo-video` gesture player; it receives `videoId`/`uri`/`title` params and should write `watch_progress` (then the progress bars here light up).
- `parseEpisode`/`formatEpisodeLabel` give next/prev-in-group episode ordering.
- Deferred: grouping refinement (see `docs/grouping-refinement-backlog.md`); drop `english`/`hq` from QUALITY_TAGS; thumbnail frame-time tuning; FlashList if grid perf needs it.
