# Shared Library Cache + Un-gated Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate two perf regressions — slow group-open and the 3–5s blank before video playback — by reading the video library from one shared in-memory cache instead of a per-screen full-table scan, and by un-gating `player.play()` from the database.

**Architecture:** Lift the cache-first library load + background device scan out of `useLibrary` into a new app-root `LibraryProvider`. Both `useLibrary` and `useGroups` become thin consumers that read the shared `videos` array and do mode-specific filtering/grouping in a memo. The player starts playback immediately and applies the resume seek when progress resolves.

**Tech Stack:** Expo SDK 56, React Native 0.85, expo-sqlite, expo-media-library, expo-video, TypeScript, Jest (jest-expo, pure-logic tests only).

## Global Constraints

- **Commits MUST NOT include any `Co-Authored-By:` or "Generated with / Claude Code" trailer.** Plain conventional commits.
- **Package manager is `bun`.** Tests: `npm test`. Typecheck: `npx tsc --noEmit`.
- **No new unit tests for native-dependent hooks/providers** — that code is device-verified by codebase convention; pure logic (`applyFilters`, grouping, `sortGroups`) is already tested and must stay green.
- **Native note:** these are JS-only changes — no native module touched, so `npx expo start` (JS reload) suffices for the user's device check; no `expo run:android` rebuild required.
- Verify every task with `npx tsc --noEmit` (clean) and `npm test` (green) before committing.

---

### Task 1: `LibraryProvider` owns the cache; `useLibrary` consumes it

Relocate the cache-first load + background scan into a new root provider, and refactor `useLibrary(mode)` to read from it. Home screen behavior must be unchanged.

**Files:**
- Create: `src/library/library-provider.tsx`
- Modify: `src/library/use-library.ts` (replace internals; keep `LibraryState` shape + return signature)
- Modify: `src/app/_layout.tsx:29-34` (mount provider inside `FilterSettingsProvider`)
- Test: none new (pure-logic tests already cover `applyFilters`/grouping)

**Interfaces:**
- Produces: `LibraryProvider({ children }: { children: ReactNode })` — React component.
- Produces: `useLibraryData(): { videos: LibraryVideo[]; status: 'loading' | 'ready' | 'denied' | 'error'; refreshing: boolean; error?: string; reload: () => void }` — context hook; throws if used outside the provider.
- Produces (unchanged): `useLibrary(mode: 'name' | 'folder'): LibraryState` where `LibraryState = { status; refreshing; groups: Group[]; error?: string }`.

- [ ] **Step 1: Create the provider with relocated load/scan logic**

Create `src/library/library-provider.tsx`. This is the existing `useLibrary` body, minus the per-mode grouping (which stays in the consumer hooks):

```tsx
import { usePermissions } from 'expo-media-library';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { deleteVideosByIds, getAllVideos, upsertVideos } from '@/db/videos-repo';
import { scanVideos } from '@/media/media-scanner';
import type { LibraryVideo } from './types';

export type LibraryStatus = 'loading' | 'ready' | 'denied' | 'error';

interface LibraryData {
  videos: LibraryVideo[];
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
export function LibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [videos, setVideos] = useState<LibraryVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permDenied, setPermDenied] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [token, setToken] = useState(0);

  // 1) Show the cached library immediately — reading our own DB needs no permission.
  useEffect(() => {
    let cancelled = false;
    getAllVideos(db)
      .then((all) => {
        if (cancelled) return;
        setVideos(all);
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
      if (!permission) return; // permission still resolving
      if (!permission.granted) {
        if (permission.canAskAgain) await requestPermission();
        else setPermDenied(true);
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
        if (removed.length) await deleteVideosByIds(db, removed);
        const all = await getAllVideos(db);
        if (cancelled) return;
        setVideos(all);
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
  }, [permission, requestPermission, db, token]);

  const reload = useCallback(() => setToken((t) => t + 1), []);

  const status: LibraryStatus = error
    ? 'error'
    : permDenied && videos.length === 0
      ? 'denied'
      : loaded
        ? 'ready'
        : 'loading';

  return (
    <LibraryContext.Provider value={{ videos, status, refreshing, error, reload }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibraryData(): LibraryData {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibraryData must be used within a LibraryProvider');
  return ctx;
}
```

- [ ] **Step 2: Refactor `use-library.ts` to consume the provider**

Replace the entire contents of `src/library/use-library.ts` with a thin consumer (same `LibraryState` shape + return signature, so `index.tsx` is untouched):

```ts
// src/library/use-library.ts
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
  const { videos, status, refreshing, error } = useLibraryData();
  const { filter } = useFilterSettings();

  const groups = useMemo(() => {
    const visible = applyFilters(videos, filter);
    return mode === 'name' ? groupByName(visible) : groupByFolder(visible);
  }, [videos, mode, filter]);

  return { status, refreshing, groups, error };
}
```

- [ ] **Step 3: Mount the provider at the app root**

In `src/app/_layout.tsx`, import the provider and nest it inside `FilterSettingsProvider`, wrapping `ThemeProvider`. Add the import:

```tsx
import { LibraryProvider } from '@/library/library-provider';
```

Change the provider tree (lines 29–34) from:

```tsx
          <FilterSettingsProvider>
            <ThemeProvider>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false }} />
            </ThemeProvider>
          </FilterSettingsProvider>
```

to:

```tsx
          <FilterSettingsProvider>
            <LibraryProvider>
              <ThemeProvider>
                <ThemedStatusBar />
                <Stack screenOptions={{ headerShown: false }} />
              </ThemeProvider>
            </LibraryProvider>
          </FilterSettingsProvider>
```

- [ ] **Step 4: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites pass (same count as before — pure-logic tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/library/library-provider.tsx src/library/use-library.ts src/app/_layout.tsx
git commit -m "refactor(library): hoist cache-first load into shared LibraryProvider"
```

---

### Task 2: `useGroups` consumes the shared cache (no DB fetch)

Drop the per-mount `getAllVideos` from `useGroups` so `group.tsx` and the player's neighbor lookup resolve from the in-memory cache instantly.

**Files:**
- Modify: `src/library/use-groups.ts` (replace internals; keep return shape)
- Test: none new

**Interfaces:**
- Consumes: `useLibraryData()` from Task 1 (`{ videos, status, refreshing, reload }`).
- Produces (unchanged): `useGroups(mode: 'name' | 'folder'): { groups: Group[]; loading: boolean; reload: () => void }`.

- [ ] **Step 1: Refactor `use-groups.ts` to consume the provider**

Replace the entire contents of `src/library/use-groups.ts` with:

```ts
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
```

- [ ] **Step 2: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/library/use-groups.ts
git commit -m "refactor(library): useGroups reads shared cache instead of re-scanning"
```

---

### Task 3: Un-gate playback from the database

Start playback immediately on player mount; apply the resume seek when the progress lookup resolves. Removes the 3–5s blank caused by `play()` waiting behind a DB read.

**Files:**
- Modify: `src/app/player.tsx:159-185` (the resume + start-playback effect)
- Test: none new (`shouldResume` is already unit-tested; effect is device-verified)

**Interfaces:**
- Consumes: existing `player` (expo-video), `getProgressMap`, `shouldResume`, refs (`currentVideoIdRef`, `lastPositionSecRef`, `lastDurationSecRef`), state setters (`setResumePositionSec`, `setSnackbarVisible`).
- Produces: no new exports.

- [ ] **Step 1: Reorder the effect so `play()` is not awaited behind the DB**

In `src/app/player.tsx`, replace the resume effect body (currently lines 159–185) with the version below. The key change: `player.play()` fires synchronously at the top of the effect; the progress read runs after and only applies the resume seek + snackbar:

```tsx
  useEffect(() => {
    currentVideoIdRef.current = videoId;
    // Reset cached position/duration for the new player so a quick exit before
    // the first timeUpdate doesn't flush stale values under the new video id.
    lastPositionSecRef.current = 0;
    lastDurationSecRef.current = 0;

    // Start playback immediately — do NOT wait on the DB. Gating play() behind
    // getProgressMap (serialized on the SQLite connection) was the main cause of
    // the multi-second black screen before playback began.
    player.play();

    let cancelled = false;
    (async () => {
      try {
        const map = await getProgressMap(db);
        if (cancelled) return;
        const saved = map.get(videoId);
        if (saved && shouldResume(saved.positionMs, saved.percent)) {
          player.currentTime = saved.positionMs / 1000;
          lastPositionSecRef.current = saved.positionMs / 1000;
          setResumePositionSec(saved.positionMs / 1000);
          setSnackbarVisible(true);
        }
      } catch {
        // Progress lookup failed — playback already started; nothing to resume.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [player, videoId, db]);
```

- [ ] **Step 2: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/player.tsx
git commit -m "fix(player): start playback immediately, apply resume seek async"
```

---

### Task 4: Gate the group empty-state on loading

Stop the "No videos in this group" flash during the brief load window.

**Files:**
- Modify: `src/app/group.tsx` (read `loading` from `useGroups`; gate `ListEmptyComponent`)
- Test: none new

**Interfaces:**
- Consumes: `useGroups(mode)` → now also destructures `loading` (from Task 2).
- Produces: no new exports.

- [ ] **Step 1: Destructure `loading` from `useGroups`**

In `src/app/group.tsx`, change line 20 from:

```tsx
  const { groups } = useGroups(mode === 'folder' ? 'folder' : 'name');
```

to:

```tsx
  const { groups, loading } = useGroups(mode === 'folder' ? 'folder' : 'name');
```

- [ ] **Step 2: Gate the empty component on loading**

In the same file, replace the `ListEmptyComponent` prop (currently lines 53–60) so it renders nothing while loading and only shows the empty state once genuinely loaded-and-empty:

```tsx
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
              <Ionicons name="film-outline" size={64} color={colors.surfaceVariant ?? '#444'} />
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
                No videos in this group
              </Text>
            </View>
          )
        }
```

- [ ] **Step 3: Typecheck and run tests**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/group.tsx
git commit -m "fix(group): hide empty-state during initial load to stop flash"
```

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` clean.
- [ ] `npm test` — all suites green (same count as start of branch).
- [ ] Whole-branch review (subagent-driven-development final review).
- [ ] **User device check** (`npx expo start`, JS reload — no native rebuild):
  - Home library loads as before.
  - Opening a multi-episode group populates instantly, no "No videos in this group" flash.
  - Playing a video starts within ~1s, no multi-second black screen.
  - Resume still jumps to the saved position and shows the "Resumed at …" snackbar.
  - Next/prev within a group still works.
  - Settings → folder-ignore list still lists folders.
```
