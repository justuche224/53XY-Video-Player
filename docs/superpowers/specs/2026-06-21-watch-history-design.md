# Watch History — Design

_Status: approved. Spec for the first v2 "history" slice. Sibling future feature: playlists (separate spec)._
_Date: 2026-06-21_

## Goal

A YouTube-style **Watch History** screen: every video the user has played, newest first, bucketed by day, searchable, each row showing a thumbnail + duration badge + watch progress bar. Reachable from a new icon button in the home header. Robust against deleted media.

This is a near-read-only feature: the watch data already exists in the `watch_progress` table (the player writes `last_played_at`, `position_ms`, `percent` on every play). History is mostly a presentation layer over that table joined against the in-memory library cache, plus single-entry and bulk removal.

## Non-goals (v1)

- YouTube's category chips (All / Videos / Shorts / Podcasts / Music) — explicitly excluded.
- Playlists — separate feature, separate spec.
- Per-day section removal, multi-select, or undo.

## What counts as a history entry

Any video that has a `watch_progress` row — i.e. anything opened in the player, **including completed videos** — appears in history, ordered by `last_played_at` descending. There is no separate "history" write path; existing progress writes are the source.

## User-facing behaviour

### Entry point
A history icon (`time-outline`, Ionicons) added to the home header pill in [src/app/index.tsx](../../../src/app/index.tsx), alongside sort / layout / settings. Tap → `router.push('/history')` (new route `src/app/history.tsx`, typed-route).

### Screen
- **Header:** back affordance (default themed stack header or in-screen back) + "History" title + a **Clear-all** trash icon on the right.
- **Search bar:** reuses `SearchBar`; live-filters the list by filename (case-insensitive substring), same idiom as home.
- **Day sections:** `Today`, `Yesterday`, then a plain formatted date (e.g. `Jun 19`) for older days, derived from each entry's `last_played_at` in device-local time. Sections are ordered newest-first; entries within a section are newest-first.
- **Rows:** thumbnail (left) using the existing `VideoThumbnail` with its duration badge, and the watch **progress bar** along the bottom of the thumbnail (reuse `ProgressBar` + the entry's `percent`); filename (primary) + folder (secondary, the "channel"-equivalent line) on the right. Tap → `router.push({ pathname: '/player', params: { videoId, uri, title: filename } })`; the player's existing resume logic seeks to the saved position.

### Actions
- **Swipe a row** → remove that single entry. Deletes its `watch_progress` row, then refetches the list. (Swipeable row via `react-native-gesture-handler`'s `Swipeable`, already a dependency.)
- **Clear all** (header trash icon) → confirm dialog (`Alert.alert`) → wipe all `watch_progress` rows, refetch (empty state).
- **Empty state:** themed icon + message, matching the home/group empty-state style (e.g. `time-outline`, "No watch history yet").

## Deleted-media handling (flagged requirement)

Two independent layers, so History is always "videos you can still play":

1. **Display filter.** History rows are resolved against the shared library cache (`useLibraryData().videos`, keyed by id). An entry whose `video_id` is not in the cache is dropped from the displayed list — a deleted video never renders. No extra full-table read; History consumes the existing in-memory array.

2. **Auto-prune (cascade).** Extend the scan-reconcile in [src/library/library-provider.tsx](../../../src/library/library-provider.tsx): it already computes `removed` (ids in DB but not in the fresh scan) and calls `deleteVideosByIds`. Add a parallel `deleteProgressByIds(db, removed)` so the orphaned `watch_progress` rows are cascade-deleted in the same reconcile. This stops orphans accumulating (they already do today, pre-feature) and keeps the DB self-cleaning.

The display filter is the correctness guarantee; the prune is hygiene. Both ship together.

## Architecture

### Data layer — `src/db/history-repo.ts` (new)
- `getHistory(db): Promise<HistoryRow[]>` — `SELECT video_id, position_ms, percent, last_played_at FROM watch_progress ORDER BY last_played_at DESC`.
- `removeHistory(db, videoId): Promise<void>` — `DELETE FROM watch_progress WHERE video_id = ?`.
- `clearHistory(db): Promise<void>` — `DELETE FROM watch_progress`.
- `HistoryRow = { videoId, positionMs, percent, lastPlayedAt }`.

### Cascade delete — `src/db/progress-repo.ts` (extend)
- `deleteProgressByIds(db, ids): Promise<void>` — no-op on empty; chunked `DELETE … WHERE video_id IN (…)` mirroring `deleteVideosByIds`.

### Migration — `src/db/schema.ts` (version 3)
- `CREATE INDEX IF NOT EXISTS idx_watch_progress_last_played ON watch_progress(last_played_at);` for the ordered read. Bump `LATEST_VERSION` to 3.

### Pure helpers (Jest-tested) — `src/history/`
- `bucket-day.ts` — `dayBucket(timestampMs, nowMs, locale?) -> { key: string; label: string }` returning `Today` / `Yesterday` / formatted-date, computed from local calendar days (not 24h windows). `nowMs` injected for deterministic tests.
- `assemble-history.ts` — `assembleHistory(rows: HistoryRow[], videos: LibraryVideo[], nowMs): HistorySection[]` — joins rows to videos by id (dropping unresolved), maps to display items (thumbUri, filename, folder, uri, percent), and groups into ordered day sections. Pure; no DB/React.
- Types in `src/history/types.ts`.

### UI — `src/app/history.tsx` (new screen)
- Loads `getHistory(db)` on focus (`useFocusEffect`), consumes `useLibraryData().videos`, runs `assembleHistory` + the search filter through `useMemo`.
- `FlashList` (or `SectionList`) rendering day-section headers + swipeable rows. Given existing FlashList usage and section needs, use a flattened section model fed to `FlashList` (header rows + item rows) to stay on the existing list stack; swipe handled per item row.
- Reuses `Screen`, `SearchBar`, `VideoThumbnail`, `ProgressBar`, theme tokens.

## Data flow

```
watch_progress (SQLite)  ──getHistory──▶  HistoryRow[]
                                              │
useLibraryData().videos  ──────────────▶  assembleHistory(rows, videos, now)
                                              │  (join by id, drop deleted, bucket by day)
                                              ▼
                                        HistorySection[] ──search filter──▶ FlashList
                                              │
                              tap ──▶ /player (resume)
                              swipe ──▶ removeHistory(id) ──▶ refetch
                              clear ──▶ clearHistory() ──▶ refetch

LibraryProvider scan reconcile:
  removed ids ──▶ deleteVideosByIds + deleteProgressByIds  (cascade prune)
```

## Testing

- **Pure helpers (Jest):** `dayBucket` (today/yesterday/older boundaries across local-day edges, injected `now`), `assembleHistory` (join, drop-deleted, ordering, section grouping, empty input).
- **Repo:** light — covered indirectly; pure logic carries the test weight per the project's lean-test convention.
- **Device-verified (user build):** screen render, search, swipe-to-remove, clear-all confirm, tap-to-resume, deleted-media not shown, prune on rescan. JS-only feature (no new native module) → `npx expo start` reload suffices; no `expo run:android` needed.

## Files touched

- New: `src/db/history-repo.ts`, `src/history/bucket-day.ts`, `src/history/assemble-history.ts`, `src/history/types.ts`, `src/app/history.tsx`, plus `__tests__`.
- Edit: `src/db/schema.ts` (migration v3 + index), `src/db/progress-repo.ts` (`deleteProgressByIds`), `src/library/library-provider.tsx` (cascade prune), `src/app/index.tsx` (header history button + route).

## Open / deferred

- Per-section "clear this day", multi-select, undo — deferred.
- If `SectionList` proves smoother than a flattened FlashList for sticky day headers, that's an implementation-time call; behaviour is identical.
