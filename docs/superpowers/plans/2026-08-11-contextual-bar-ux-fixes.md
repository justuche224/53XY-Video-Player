# Contextual App Bar UX Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the contextual app bar overflowing on real phones, make "Play" actually play video, and collapse the always-both-shown Mark Played/Unplayed icons into one context-aware toggle.

**Architecture:** `ContextualAppBar` shrinks to a fixed 6-element row (Close, count, Play, Share, Delete, ⋮) that always fits. A new `OverflowMenuSheet` component (same Modal+backdrop pattern as the existing `EditGroupSheet`/`AddToPlaylistSheet`) renders the rest of the actions as a tappable list. A new pure `resolveWatchToggle` helper decides the Mark Played/Unplayed label and direction from the selection's actual watch state. Home's `handlePlay` is fixed to route directly into the player (like Group Detail already does) instead of navigating to a list screen.

**Tech Stack:** React Native / Expo Router, TypeScript, Jest, existing app theme system (`useTheme()`), Ionicons.

## Global Constraints

- JS-only change — no native module touched, no `expo run:android` needed, `npx expo start` reload is sufficient.
- No DB/schema changes.
- Follow the project's existing testing convention: pure logic (`src/library/*`, `src/player/*`) gets Jest tests; RN UI components (sheets, bars) do not have dedicated component tests in this codebase — verify those by `tsc` + manual device check instead.
- Every task must leave `npx tsc --noEmit` clean and `npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"` fully green before its commit.
- Spec: `docs/superpowers/specs/2026-08-11-contextual-bar-ux-design.md`.

**Note on the spec's Play-semantics section:** re-reading `group.tsx` while planning, the existing `onPlay` handler already picks the earliest item in the group's own order (it does `group.items.filter(v => selectedIds.has(v.id))[0]`, and `Array.prototype.filter` preserves the source array's order — not tap/Set-insertion order as the spec assumed). So Group Detail's Play needs no behavior change, just rewiring to the new bar API. Task 3 reflects this — it's a wiring change there, not a bug fix. Home's Play is the real bug (routes to a list screen instead of the player) and is fixed as designed.

---

### Task 1: `resolveWatchToggle` pure helper

**Files:**
- Create: `src/library/watch-toggle.ts`
- Test: `src/library/__tests__/watch-toggle.test.ts`

**Interfaces:**
- Consumes: `ProgressMap` from `src/db/progress-repo.ts` (`Map<string, { positionMs: number; percent: number }>`).
- Produces: `resolveWatchToggle(selectedIds: string[], progress: ProgressMap): WatchToggle` where `WatchToggle = { label: 'Mark as played' | 'Mark as unplayed'; markPlayed: boolean }`. Task 3 imports both the function and the `WatchToggle` type from `@/library/watch-toggle`.

- [ ] **Step 1: Write the failing tests**

Create `src/library/__tests__/watch-toggle.test.ts`:

```ts
import { resolveWatchToggle } from '../watch-toggle';
import type { ProgressMap } from '@/db/progress-repo';

function progressMap(entries: Array<[string, number]>): ProgressMap {
  const map: ProgressMap = new Map();
  for (const [id, percent] of entries) map.set(id, { positionMs: 0, percent });
  return map;
}

describe('resolveWatchToggle', () => {
  it('reads "Mark as played" when nothing in the selection has progress', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  it('reads "Mark as unplayed" when every selected item is fully played', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', 1], ['b', 1]]));
    expect(result).toEqual({ label: 'Mark as unplayed', markPlayed: false });
  });

  it('reads "Mark as played" for a mixed selection (finishes the batch off)', () => {
    const result = resolveWatchToggle(['a', 'b'], progressMap([['a', 1], ['b', 0.4]]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });

  it('treats percent >= 0.99 as fully played, matching the rest of the app\'s convention', () => {
    const result = resolveWatchToggle(['a'], progressMap([['a', 0.995]]));
    expect(result).toEqual({ label: 'Mark as unplayed', markPlayed: false });
  });

  it('defaults to "Mark as played" for an empty selection', () => {
    const result = resolveWatchToggle([], progressMap([]));
    expect(result).toEqual({ label: 'Mark as played', markPlayed: true });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/library/__tests__/watch-toggle.test.ts`
Expected: FAIL — `Cannot find module '../watch-toggle'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/library/watch-toggle.ts`:

```ts
import type { ProgressMap } from '@/db/progress-repo';

export interface WatchToggle {
  label: 'Mark as played' | 'Mark as unplayed';
  markPlayed: boolean;
}

// >= 0.99 matches the "effectively complete" threshold already used elsewhere
// in the app (e.g. `groupPercent` in the Home screen treats < 0.99 as "still
// in progress").
export function resolveWatchToggle(selectedIds: string[], progress: ProgressMap): WatchToggle {
  const allPlayed =
    selectedIds.length > 0 &&
    selectedIds.every((id) => (progress.get(id)?.percent ?? 0) >= 0.99);

  return allPlayed
    ? { label: 'Mark as unplayed', markPlayed: false }
    : { label: 'Mark as played', markPlayed: true };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/library/__tests__/watch-toggle.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/library/watch-toggle.ts src/library/__tests__/watch-toggle.test.ts
git commit -m "feat: add resolveWatchToggle for smart mark-played/unplayed"
```

---

### Task 2: `OverflowMenuSheet` component

**Files:**
- Create: `src/components/overflow-menu-sheet.tsx`

**Interfaces:**
- Consumes: the app's `useTheme()` token resolver (`colors`, `radius`, `spacing` — same fields used by `EditGroupSheet`/`AddToPlaylistSheet`), `AppText` from `./app-text`, `Ionicons` from `@expo/vector-icons`.
- Produces: `OverflowAction = { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }` and `OverflowMenuSheet({ visible, actions, onClose })`. Task 3 imports both from `@/components/overflow-menu-sheet` (and re-exports `OverflowAction` from `contextual-app-bar.tsx` for its own callers' convenience).

This is a new, standalone UI component not yet wired into anything — it can't regress existing behavior, so no dedicated test is needed (matches this codebase's convention of not unit-testing RN sheet components; see Global Constraints).

- [ ] **Step 1: Create the component**

Create `src/components/overflow-menu-sheet.tsx`:

```tsx
import { Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { useTheme } from '@/theme/theme-provider';

export interface OverflowAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

/**
 * Bottom sheet listing the contextual app bar's lower-frequency actions.
 * Same Modal + backdrop-Pressable + sheet-Pressable pattern as
 * `EditGroupSheet`/`AddToPlaylistSheet`, so it matches the rest of the app's
 * sheets visually and in dismiss behavior (tap backdrop or back button to
 * close).
 */
export function OverflowMenuSheet({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: OverflowAction[];
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1b1b1b',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={() => {}}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [
                styles.row,
                { gap: spacing.md, paddingVertical: spacing.md, opacity: pressed ? 0.6 : 1 },
              ]}
              onPress={() => {
                onClose();
                action.onPress();
              }}>
              <Ionicons name={action.icon} size={22} color={colors.onSurface} />
              <AppText variant="body">{action.label}</AppText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (component is unused so far — that's fine, it will be wired in Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/components/overflow-menu-sheet.tsx
git commit -m "feat: add OverflowMenuSheet for contextual bar overflow actions"
```

---

### Task 3: Redesign `ContextualAppBar` and rewire both consumers

This is one task because the bar's prop-surface change is only meaningful together with its two callers — an intermediate state where the bar has the new API but a caller still passes the old props would not typecheck, so they move together.

**Files:**
- Modify: `src/components/contextual-app-bar.tsx` (full prop surface change)
- Modify: `src/app/group.tsx:142-198` (ContextualAppBar usage block)
- Modify: `src/app/(tabs)/index.tsx:305-336` (`handlePlay`/`handleMarkPlayed`/`handleMarkUnplayed`) and `:408-430` (ContextualAppBar usage block)

**Interfaces:**
- Consumes: `resolveWatchToggle`/`WatchToggle` (Task 1), `OverflowMenuSheet`/`OverflowAction` (Task 2).
- Produces: `ContextualAppBar({ selectedCount, onClearSelection, onPlay?, onShare, onDelete, overflowActions })` — the only two callers are updated in this same task, so no other task depends on the old prop names.

- [ ] **Step 1: Rewrite `contextual-app-bar.tsx`**

Replace the full contents of `src/components/contextual-app-bar.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { OverflowMenuSheet, type OverflowAction } from './overflow-menu-sheet';
import { useTheme } from '@/theme/theme-provider';

export type { OverflowAction } from './overflow-menu-sheet';

export function ContextualAppBar({
  selectedCount,
  onClearSelection,
  onPlay,
  onShare,
  onDelete,
  overflowActions,
}: {
  selectedCount: number;
  onClearSelection: () => void;
  /** Omit to hide the Play icon — used when Play has no single unambiguous target. */
  onPlay?: () => void;
  onShare: () => void;
  onDelete: () => void;
  overflowActions: OverflowAction[];
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={[
          styles.pinned,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.sm,
            backgroundColor: colors.surfaceContainerHigh ?? colors.surfaceVariant,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.outlineVariant ?? 'transparent',
          },
        ]}>
        <View style={[styles.row, { gap: spacing.xs, minHeight: 48, paddingBottom: spacing.sm }]}>
          <IconButton
            name="close"
            onPress={onClearSelection}
            accessibilityLabel="Clear selection"
          />
          <AppText variant="title" style={{ flex: 1, paddingLeft: spacing.xs }}>
            {selectedCount}
          </AppText>
          {onPlay ? (
            <IconButton name="play-outline" onPress={onPlay} accessibilityLabel="Play selected" />
          ) : null}
          <IconButton name="share-outline" onPress={onShare} accessibilityLabel="Share selected" />
          <IconButton name="trash-outline" onPress={onDelete} accessibilityLabel="Delete selected" />
          {overflowActions.length > 0 ? (
            <IconButton
              name="ellipsis-vertical"
              onPress={() => setOverflowOpen(true)}
              accessibilityLabel="More actions"
            />
          ) : null}
        </View>
      </Animated.View>
      <OverflowMenuSheet
        visible={overflowOpen}
        actions={overflowActions}
        onClose={() => setOverflowOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  row: { flexDirection: 'row', alignItems: 'center' },
});
```

- [ ] **Step 2: Rewire `src/app/group.tsx`**

Add the import (next to the other `@/library`/`@/db` imports):

```ts
import { resolveWatchToggle } from '@/library/watch-toggle';
```

Add, right before the component's `return (` statement (after the `openVideo` callback and before `return`):

```ts
  const watchToggle = resolveWatchToggle(Array.from(selectedIds), progress);
```

Replace the existing `{selectedIds.size === 0 ? ( ... ) : ( <ContextualAppBar ... /> )}` block with:

```tsx
      {selectedIds.size === 0 ? (
        <View style={[styles.back, { top: insets.top + spacing.sm, left: spacing.lg }]}>
          <IconButton name="arrow-back" tone="artwork" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
      ) : (
        <ContextualAppBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onPlay={() => {
            const first = group?.items.find((v) => selectedIds.has(v.id));
            if (!first) return;
            openVideo(first);
            setSelectedIds(new Set());
          }}
          onShare={() => {
            const uris = group?.items.filter(v => selectedIds.has(v.id)).map(v => v.uri) ?? [];
            shareVideos(uris);
          }}
          onDelete={() => {
            const ids = Array.from(selectedIds);
            deleteVideos(ids, () => {
              setSelectedIds(new Set());
              reload();
            });
          }}
          overflowActions={[
            ...(selectedIds.size === 1
              ? [
                  {
                    icon: 'information-circle-outline',
                    label: 'View info',
                    onPress: () => setInfoVideoId(Array.from(selectedIds)[0]),
                  },
                ]
              : []),
            {
              icon: watchToggle.markPlayed ? 'checkmark-done-circle-outline' : 'ellipse-outline',
              label: watchToggle.label,
              onPress: async () => {
                const ids = Array.from(selectedIds);
                await setVideosPlayedState(db, ids, watchToggle.markPlayed, Date.now());
                setSelectedIds(new Set());
                setProgress((prev) => {
                  const next = new Map(prev);
                  for (const id of ids) {
                    if (watchToggle.markPlayed) next.set(id, { percent: 1, positionMs: 0 });
                    else next.delete(id);
                  }
                  return next;
                });
              },
            },
            {
              icon: 'list-outline',
              label: 'Add to playlist',
              onPress: () => {
                if (selectedIds.size > 0) setPlaylistVideoIds(Array.from(selectedIds));
              },
            },
            {
              icon: 'folder-open-outline',
              label: 'Move to group',
              onPress: () => {
                if (selectedIds.size > 0) setUngroupVideoIds(Array.from(selectedIds));
              },
            },
          ]}
        />
      )}
```

(`onInfo` is gone from the bar's props entirely — Info is now always an overflow row, conditionally included only when exactly one item is selected, same visibility rule as before.)

- [ ] **Step 3: Rewire `src/app/(tabs)/index.tsx`**

Add the import:

```ts
import { resolveWatchToggle } from '@/library/watch-toggle';
```

Replace the whole block from `const selectedGroups = useMemo(...)` through the end of `handleMarkUnplayed` (currently lines 287-336 — this includes `selectedGroups`, `handleDelete`, and `handleShare` unchanged; only `handlePlay`/`handleMarkPlayed`/`handleMarkUnplayed` actually change) with:

```ts
  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedKeys.has(g.key)),
    [groups, selectedKeys]
  );
  const selectedVideoIds = useMemo(
    () => selectedGroups.flatMap((g) => g.items.map((i) => i.id)),
    [selectedGroups],
  );
  const watchToggle = resolveWatchToggle(selectedVideoIds, progress);

  const handleDelete = useCallback(() => {
    const ids = selectedVideoIds;
    deleteVideos(ids, () => {
      setSelectedKeys(new Set());
      reload();
    });
  }, [selectedVideoIds, reload]);

  const handleShare = useCallback(() => {
    const uris = selectedGroups.flatMap((g) => g.items.map((i) => i.uri));
    shareVideos(uris);
  }, [selectedGroups]);

  // Only meaningful for exactly one selected group — the bar hides the Play
  // icon otherwise (see ContextualAppBar's onPlay usage below).
  const handlePlay = useCallback(() => {
    if (selectedGroups.length !== 1) return;
    const group = selectedGroups[0];
    const v = group.items[0];
    if (!v) return;
    const params =
      group.count > 1
        ? { videoId: v.id, uri: v.uri, title: v.filename, groupKey: group.key, mode }
        : { videoId: v.id, uri: v.uri, title: v.filename };
    router.push({ pathname: '/player', params });
    setSelectedKeys(new Set());
  }, [selectedGroups, mode, router]);

  const handleToggleWatched = useCallback(async () => {
    const ids = selectedVideoIds;
    await setVideosPlayedState(db, ids, watchToggle.markPlayed, Date.now());
    setSelectedKeys(new Set());
    setProgress((prev) => {
      const next = new Map(prev);
      for (const id of ids) {
        if (watchToggle.markPlayed) next.set(id, { percent: 1, positionMs: 0 });
        else next.delete(id);
      }
      return next;
    });
  }, [selectedVideoIds, watchToggle, db]);
```

`handleDelete` now reads from the `selectedVideoIds` memo instead of re-deriving the same expression inline — behaviorally identical, since it was already `selectedGroups.flatMap((g) => g.items.map((i) => i.id))`. `handleShare` is untouched.

Replace the `<ContextualAppBar ... />` block (currently at lines 408-430) with:

```tsx
      {selectedKeys.size > 0 && (
        <ContextualAppBar
          selectedCount={selectedKeys.size}
          onClearSelection={() => setSelectedKeys(new Set())}
          onPlay={selectedGroups.length === 1 ? handlePlay : undefined}
          onShare={handleShare}
          onDelete={handleDelete}
          overflowActions={[
            {
              icon: watchToggle.markPlayed ? 'checkmark-done-circle-outline' : 'ellipse-outline',
              label: watchToggle.label,
              onPress: handleToggleWatched,
            },
            {
              icon: 'list-outline',
              label: 'Add to playlist',
              onPress: () => {
                if (selectedVideoIds.length > 0) setPlaylistVideoIds(selectedVideoIds);
              },
            },
            {
              icon: 'folder-open-outline',
              label: 'Move to group',
              onPress: () => {
                if (selectedVideoIds.length > 0) setUngroupVideoIds(selectedVideoIds);
              },
            },
          ]}
        />
      )}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If any `icon: '...'` literal complains about being widened to `string`, it means the array wasn't contextually typed by the `overflowActions` prop — double check the array literal is passed directly inline to the prop (not assigned to an intermediate untyped `const` first), which is how both blocks above are written.

- [ ] **Step 5: Run the full test suite**

Run: `npx jest --testPathIgnorePatterns "/node_modules/|/\.claude/"`
Expected: all suites pass (no regressions — nothing in this task touches tested pure logic other than `resolveWatchToggle`, already covered by Task 1).

- [ ] **Step 6: Commit**

```bash
git add src/components/contextual-app-bar.tsx src/app/group.tsx "src/app/(tabs)/index.tsx"
git commit -m "fix: contextual bar overflow menu, smart watch toggle, Home play routing"
```

---

## Manual Verification (device, after all tasks land)

Per this project's workflow, native/device verification is the user's own build — reload via `npx expo start` (JS-only change, no rebuild needed):

- [ ] Home: select 3+ groups — bar shows Close, count, Share, Delete, ⋮ only (no Play — more than one group selected). Tap ⋮ — sheet lists Mark as played/unplayed, Add to playlist, Move to group.
- [ ] Home: select exactly one multi-episode group, tap Play — the player opens and starts playing (not the group screen).
- [ ] Group Detail: select 5+ episodes (enough that the old bar would have overflowed) — bar still fits on one row.
- [ ] Group Detail: select exactly one video, open ⋮ — "View info" is present; select a second video — "View info" disappears from the sheet.
- [ ] Select a mix of watched/unwatched items, open ⋮ — row reads "Mark as played"; tap it, reopen ⋮ on the same (now all-played) selection — row reads "Mark as unplayed".
- [ ] Add to playlist and Move to group both still work from the overflow sheet (same behavior as the old icons).
- [ ] Share and Delete still behave as before (single-file share limit alert, delete confirmation dialog).
