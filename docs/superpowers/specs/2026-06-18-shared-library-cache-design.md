# Shared Library Cache + Un-gated Playback — Design

_2026-06-18 · branch `fix/shared-library-cache`_

## Problem

Two perceived performance regressions, both scaling with library size (the user's
library has grown — full seasons of Boston Legal, Citadel, etc.):

1. **Opening a group is slow to populate (~1–2s)** — the group screen shows the
   "No videos in this group" empty state, then items pop in, then thumbnails fill.
2. **Playing a video is blank for ~3–5s before playback starts** — worse than #1.

### Root cause

Both [`group.tsx`](../../../src/app/group.tsx) and [`player.tsx`](../../../src/app/player.tsx)
call `useGroups()`, which on every mount runs `getAllVideos(db)` —
`SELECT * FROM videos` over the **entire table** — then groups all of it in memory
just to pick out the one group by key. There is no shared cache with the home
screen (`useLibrary` is a separate hook instance), so each navigation pays the full
read + group cost again. As the library grows, this gets slower.

- **Group screen:** until that scan resolves, `group` is `undefined`, list data is
  `[]`, and FlashList renders the `ListEmptyComponent` ("No videos in this group",
  added in the QOL polish) — that is the flash. Then items appear; thumbnails then
  generate one-by-one via `requestIdleCallback`.
- **Player:** the resume effect does `await getProgressMap(db)` **then**
  `player.play()`. expo-sqlite serializes queries on one connection, and
  `useGroups`'s full-table `getAllVideos` is queued **ahead** of `getProgressMap`,
  so `play()` cannot fire until the whole library has been read and mapped.
  Playback is gated behind a full-library scan.

## Solution

Lift the cache-first library load into a single app-root provider, and un-gate
playback from the database.

### 1. `LibraryProvider` (new) — single source of truth

A new provider mounted at the app root next to `FilterSettingsProvider` in
[`_layout.tsx`](../../../src/app/_layout.tsx). It owns the raw library and runs the
cache-first load + background device scan **once per app session** — relocated, not
rewritten, from `useLibrary`.

Exposed via context:

```ts
interface LibraryData {
  videos: LibraryVideo[];          // raw, unfiltered, ungrouped
  status: 'loading' | 'ready' | 'denied' | 'error';
  refreshing: boolean;             // background scan in flight
  error?: string;
  reload: () => void;
}
```

**Decision:** the provider exposes *raw videos*; grouping stays in the consumer
hooks (memoized). Grouping is mode-specific (name vs folder) and cheap relative to
the DB read; computing both eagerly would waste work. The expensive part — the DB
read + device scan — is what we deduplicate.

### 2. `useLibrary(mode)` — thin consumer

Reads `videos` + status from the provider, applies `applyFilters` then grouping
(`groupByName` / `groupByFolder`), memoized per mode. **Return shape is unchanged**
(`{ status, refreshing, groups, error }`), so [`index.tsx`](../../../src/app/index.tsx)
needs no changes. All scan/permission/SQLite logic moves to the provider.

### 3. `useGroups(mode)` — thin consumer

Reads the same shared `videos`, applies filters + grouping. **No DB fetch.** So
`group.tsx` and the player's neighbor lookup resolve instantly from the in-memory
cache — no per-navigation full-table scan. Return shape stays
`{ groups, loading, reload }`; `loading` maps to the provider's `status !== 'ready'`.

### 4. Un-gate playback (the 3–5s blank)

In the [`player.tsx`](../../../src/app/player.tsx) resume effect: call
`player.play()` **immediately** on mount rather than after
`await getProgressMap(db)`. When the progress lookup resolves, apply the resume seek
(`player.currentTime = saved.positionMs / 1000`) and show the snackbar. Decoding
starts right away; the resume jump happens a beat later if there is saved progress.
Combined with #1–#3 (no full-table scan clogging the connection ahead of the
progress read), this removes the bulk of the delay.

### 5. Empty-state flash

In `group.tsx`, gate the "No videos in this group" `ListEmptyComponent` on the
loading state — render nothing (or a spinner) while loading; show the empty state
only once genuinely loaded-and-empty.

## Consumers to verify

- **`index.tsx`** (home) — uses `useLibrary`; unchanged by design.
- **`group.tsx`** — uses `useGroups`; gets the empty-state gate.
- **`player.tsx`** — uses `useGroups` for neighbors; gets the play() un-gating.
- **Settings `FolderIgnoreList`** — sources the folder list from the library; must
  still receive folders from the shared cache.

## Behavioral notes

- The background device scan now starts at app launch (provider mount) rather than
  when home mounts. Home is the initial route, so this is equivalent in practice and
  the permission request fires the same way.
- Progress (`getProgressMap`) remains per-screen via `useFocusEffect` — out of scope
  for this change; only its *ordering* relative to the library read is fixed by #4.

## Testing

- Pure logic (`applyFilters`, `groupByName`/`groupByFolder`, `sortGroups`) is
  unaffected — existing tests stay green.
- Adjust/add tests where the hook contracts change (provider load/reconcile logic is
  relocated, not rewritten).
- `npx tsc --noEmit` clean; `npm test` green.
- Device-verify (user's build): group opens instantly; video starts without the
  multi-second blank; no empty-state flash.

## Out of scope

- The deferred RNGH gesture-arena fix and the "gate resume seek on ready event"
  refinement (the play() un-gating here is the simpler, sufficient fix).
- Thumbnail generation strategy (`requestIdleCallback`) is unchanged.
