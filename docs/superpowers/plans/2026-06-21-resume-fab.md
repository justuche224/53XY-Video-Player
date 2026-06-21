# Resume FAB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "▶ Resume" extended FAB to the home screen that opens the player on the most-recently-played video that still exists, resuming at its saved position and preserving group context so next/prev work.

**Architecture:** One new tested pure helper (`resolveLastPlayed`) walks history newest-first and returns the first entry whose video is still in the in-memory library cache. A presentational `ResumeFab` component renders the extended FAB. The home screen fetches history on focus, derives the target, renders the FAB when present, and on tap resolves the target's group (from the already-computed `groups`) and pushes to the existing player route with `groupKey`/`mode` when it's a multi-item group.

**Tech Stack:** Expo SDK 56 / React Native 0.85, expo-router, expo-sqlite, Jest for the pure helper.

## Global Constraints

- **Android-only**, Expo SDK 56. Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code if unsure.
- **Package manager is `bun`.** No new deps needed. Tests: `npm test`. Typecheck: `npx tsc --noEmit` (must stay clean).
- **Commits are plain conventional commits — NO `Co-Authored-By` / "Generated with Claude Code" trailer.**
- **Testing convention (lean):** pure logic gets Jest tests; React/native UI is verified by `tsc` + the user's device build (no component-test harness in this repo). UI tasks gate on `tsc`, not Jest.
- **No new native module** → JS-only; ships on `npx expo start` reload, no `expo run:android`.
- `colors` is a full Material3 scheme (`primary`, `onPrimary`, `primaryContainer`, `onPrimaryContainer`, `background`, etc. all exist); existing code uses `?? fallback` defensively — keep that style.
- The player route already accepts optional `groupKey`/`mode` params and derives prev/next from them — **do not modify the player.**

---

### Task 1: Pure helper — `resolveLastPlayed`

**Files:**
- Create: `src/player/resume-last.ts`
- Test: `src/player/__tests__/resume-last.test.ts`

**Interfaces:**
- Consumes: `HistoryRow` from `@/db/history-repo` (`{ videoId, positionMs, percent, lastPlayedAt }`); `LibraryVideo` from `@/library/types`.
- Produces: `resolveLastPlayed(rows: HistoryRow[], videosById: Map<string, LibraryVideo>): LibraryVideo | null` — returns the `LibraryVideo` for the first row (rows are already newest-first) whose `videoId` exists in `videosById`; `null` if none resolve.

- [ ] **Step 1: Write the failing test**

Create `src/player/__tests__/resume-last.test.ts`:

```ts
import { resolveLastPlayed } from '../resume-last';
import type { LibraryVideo } from '@/library/types';
import type { HistoryRow } from '@/db/history-repo';

const vid = (id: string): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs: 1000,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const row = (videoId: string, lastPlayedAt: number): HistoryRow => ({
  videoId,
  positionMs: 0,
  percent: 0,
  lastPlayedAt,
});

const byId = (vids: LibraryVideo[]) => new Map(vids.map((v) => [v.id, v]));

describe('resolveLastPlayed', () => {
  it('returns the most-recent video when it still exists', () => {
    const rows = [row('a', 200), row('b', 100)];
    const result = resolveLastPlayed(rows, byId([vid('a'), vid('b')]));
    expect(result?.id).toBe('a');
  });

  it('skips a deleted most-recent and returns the next existing video', () => {
    const rows = [row('gone', 200), row('b', 100)];
    const result = resolveLastPlayed(rows, byId([vid('b')]));
    expect(result?.id).toBe('b');
  });

  it('returns null when there are no rows', () => {
    expect(resolveLastPlayed([], byId([vid('a')]))).toBeNull();
  });

  it('returns null when every row points to a deleted video', () => {
    const rows = [row('gone1', 200), row('gone2', 100)];
    expect(resolveLastPlayed(rows, byId([]))).toBeNull();
  });

  it('returns the full LibraryVideo object (not just the id)', () => {
    const result = resolveLastPlayed([row('a', 1)], byId([vid('a')]));
    expect(result).toEqual(vid('a'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- resume-last`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/player/resume-last.ts`**

```ts
import type { HistoryRow } from '@/db/history-repo';
import type { LibraryVideo } from '@/library/types';

/**
 * Walk history (already ordered newest-first) and return the first entry whose
 * video still exists in the library cache. Returns null when none resolve —
 * e.g. empty history, or every played video has since been deleted.
 */
export function resolveLastPlayed(
  rows: HistoryRow[],
  videosById: Map<string, LibraryVideo>,
): LibraryVideo | null {
  for (const row of rows) {
    const video = videosById.get(row.videoId);
    if (video) return video;
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- resume-last`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/player/resume-last.ts src/player/__tests__/resume-last.test.ts
git commit -m "feat(player): resolveLastPlayed helper (most-recent existing video)"
```

---

### Task 2: `ResumeFab` component

**Files:**
- Create: `src/components/resume-fab.tsx`

**Interfaces:**
- Consumes: `useTheme` from `@/theme/theme-provider`; `Ionicons` from `@expo/vector-icons`.
- Produces: `ResumeFab({ onPress }: { onPress: () => void })` — a themed Material You extended FAB (play icon + "Resume" text), absolutely positioned bottom-right. Presentational only; the parent decides whether to render it.

No Jest test (UI). Gate on `tsc`; device-verified later.

- [ ] **Step 1: Create `src/components/resume-fab.tsx`**

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/theme-provider';

export function ResumeFab({ onPress }: { onPress: () => void }) {
  const { colors, spacing } = useTheme();
  const fg = colors.onPrimaryContainer ?? colors.onPrimary ?? '#fff';
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: fg, borderless: false }}
      style={[
        styles.fab,
        {
          backgroundColor: colors.primaryContainer ?? colors.primary,
          bottom: spacing.lg,
          right: spacing.lg,
        },
      ]}
    >
      <Ionicons name="play" size={20} color={fg} />
      <Text style={[styles.label, { color: fg }]}>Resume</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { fontSize: 15, fontWeight: '700' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/resume-fab.tsx
git commit -m "feat(player): Resume extended FAB component"
```

---

### Task 3: Wire the FAB into the home screen

**Files:**
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: `resolveLastPlayed` (`@/player/resume-last`); `getHistory` (`@/db/history-repo`); `ResumeFab` (`@/components/resume-fab`); `useLibraryData` (`@/library/library-provider`); `LibraryVideo` type (`@/library/types`). The screen already has `groups` (from `useLibrary(mode)`), `mode`, `router`, `db`, and an existing focus effect that fetches progress.
- Produces: a Resume FAB shown only when there's a resumable target; tap navigates to `/player` with group context when the target is in a multi-item group.

UI/integration; gate on `tsc` + full `npm test` (must stay green). Device-verified later.

- [ ] **Step 1: Add imports**

In `src/app/index.tsx`, add these imports alongside the existing ones (the file already imports `useCallback`, `useMemo`, `useState`, `useFocusEffect`, `useRouter`, `getProgressMap`, and `type { Group }`):

```tsx
import { getHistory } from '@/db/history-repo';
import { resolveLastPlayed } from '@/player/resume-last';
import { ResumeFab } from '@/components/resume-fab';
import { useLibraryData } from '@/library/library-provider';
import type { LibraryVideo } from '@/library/types';
```

- [ ] **Step 2: Add the cached videos + resume-target state**

Just after the existing `const { status, refreshing, groups } = useLibrary(mode);` line, add:

```tsx
  const { videos } = useLibraryData();
  const [resumeTarget, setResumeTarget] = useState<LibraryVideo | null>(null);
```

- [ ] **Step 3: Extend the focus effect to compute the resume target**

Replace the existing focus effect:

```tsx
  // Refetch progress every time the screen regains focus (e.g. returning from
  // the player), so resume bars update without an app reload.
  useFocusEffect(
    useCallback(() => {
      if (status === 'ready') getProgressMap(db).then(setProgress);
    }, [db, status]),
  );
```

with:

```tsx
  // On focus (e.g. returning from the player), refetch progress so resume bars
  // update, and recompute the Resume FAB target from history + the live cache.
  useFocusEffect(
    useCallback(() => {
      if (status !== 'ready') return;
      getProgressMap(db).then(setProgress);
      getHistory(db).then((rows) => {
        const byId = new Map(videos.map((v) => [v.id, v]));
        setResumeTarget(resolveLastPlayed(rows, byId));
      });
    }, [db, status, videos]),
  );
```

- [ ] **Step 4: Add the resume handler**

Just after the existing `openGroup` callback, add:

```tsx
  const onResume = useCallback(() => {
    if (!resumeTarget) return;
    const group = groups.find((g) => g.items.some((it) => it.id === resumeTarget.id));
    const params =
      group && group.count > 1
        ? { videoId: resumeTarget.id, uri: resumeTarget.uri, title: resumeTarget.filename, groupKey: group.key, mode }
        : { videoId: resumeTarget.id, uri: resumeTarget.uri, title: resumeTarget.filename };
    router.push({ pathname: '/player', params });
  }, [resumeTarget, groups, mode, router]);
```

- [ ] **Step 5: Render the FAB**

In the returned JSX, find the closing of the screen — the `<SortSheet … />` element immediately before the closing `</Screen>` tag. Add the FAB right after `<SortSheet … />`:

```tsx
      <SortSheet
        visible={sortOpen}
        sortKey={sortKey}
        sortDir={sortDir}
        onSelect={onSort}
        onClose={() => setSortOpen(false)}
      />
      {resumeTarget ? <ResumeFab onPress={onResume} /> : null}
    </Screen>
```

(Only the `{resumeTarget ? … }` line is new; the `<SortSheet>` block is shown for placement context — do not duplicate it.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean. (If a transient typed-routes complaint about `/player` appears, it regenerates on `expo start`; the route already exists, so any other error must be fixed.)

- [ ] **Step 7: Run the full suite**

Run: `npm test`
Expected: PASS (existing suites + the new `resume-last` tests).

- [ ] **Step 8: Commit**

```bash
git add src/app/index.tsx
git commit -m "feat(player): home-screen Resume FAB wiring"
```

---

## Final verification (whole feature)

- [ ] `npm test` — all suites pass including `resume-last`.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `git log --oneline` shows plain commits, no `Co-Authored-By` trailer.
- [ ] **Hand to user for device verification** (`npx expo start`, no native rebuild):
  - With watch history present, a "▶ Resume" FAB shows bottom-right on the home screen.
  - Tap → player opens on the last-played video and resumes at the saved position.
  - When the last-played video belongs to a multi-item group (e.g. S01E02), next/prev work in the player.
  - Delete the last-played video from the device, reopen the app → FAB now resumes the next-most-recent existing video.
  - With no history (or every history entry's video deleted), the FAB is hidden.

## Spec coverage check

- Extended "Resume" FAB, bottom-right, hidden when no target → Task 2 (component) + Task 3 (conditional render).
- Most-recent existing target, skip deleted, null when none → Task 1 (`resolveLastPlayed`) + Task 3 (focus fetch).
- Resume at saved position → existing player logic (no task; verified in checklist).
- Group context / working next-prev for grouped videos; standalone = resume only → Task 3 (`onResume` group lookup, `groupKey`/`mode` only when `count > 1`).
- Deleted-media fallback → Task 1 walk + Task 3 (`byId` built from live cache).
- All spec sections mapped.
