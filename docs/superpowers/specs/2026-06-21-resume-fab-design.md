# Resume FAB — Design

_Status: approved. Small v2 slice building on the Watch History data (`watch_progress`). Date: 2026-06-21._

## Goal

A Material You **extended FAB** ("▶ Resume", bottom-right of the home screen) that opens the player on the most-recently-played video that still exists, resuming at its saved position, **with group context** so the player's next/prev work exactly as when playing from a group (e.g. on S01E02 you can press next → S01E03).

## User-facing behaviour

- An extended FAB labelled **Resume** with a play icon, anchored bottom-right of the home library screen, floating over the list.
- **Tap** → navigate to `/player` for the resume target, which resumes at its saved position (existing player resume logic).
- The FAB is **hidden** when there is no resumable target (empty history, or every history entry's video has been deleted).

## Picking the target (deleted-media handling)

On home-screen focus, read history via `getHistory(db)` (already ordered `last_played_at DESC`) and walk it to the **first entry whose `videoId` is still present in the cached library** (`useLibraryData().videos`). That entry is the resume target.

- If the most-recent video was deleted, the walk falls through to the next-most-recent that still exists.
- If none of the history entries resolve to an existing video, there is no target → the FAB is hidden.

This mirrors the History screen's display-time filter and relies on the same in-memory cache (no extra full-table read of `videos`).

## Group context (so next/prev work)

Once the target video is known, find which group it belongs to under the **current persisted `mode`** (`name` / `folder`) by locating it in the home screen's already-computed `groups` (from `useLibrary(mode)`):

- The target is in a **multi-item group** (`count > 1`) → `router.push({ pathname: '/player', params: { videoId, uri, title, groupKey: group.key, mode } })`. The player computes prev/next from `group.items` exactly as today.
- The target is **standalone** (no group, or a `count === 1` group) → `router.push({ pathname: '/player', params: { videoId, uri, title } })`. Resume only; no neighbours. (Confirmed in design: standalone does not walk the whole library.)

The group is resolved under the *current* mode rather than the mode the video was originally launched from. This needs no schema change and is consistent with the rest of the app, where `mode` is a single global persisted setting. The player already accepts optional `groupKey`/`mode` params and derives neighbours from them ([src/app/player.tsx](../../../src/app/player.tsx) lines ~41-63), so no player change is required.

Edge case: if the target video is currently hidden by an active library filter, it won't appear in any visible group → it is treated as standalone (resume only). Acceptable; resuming should not be blocked, and neighbours simply aren't offered.

## Resume position

Handled entirely by the player's existing logic: on mount it reads `watch_progress` for `videoId` and seeks to the saved position. "Continue where I stopped" comes for free. If the target was finished, the player opens at the end and the existing replay-on-play fix restarts it on the first play press. No new resume code.

## Architecture & decomposition

### Pure helper — `src/player/resume-last.ts` (new, Jest-tested)
- `resolveLastPlayed(rows: HistoryRow[], videosById: Map<string, LibraryVideo>): LibraryVideo | null`
  - Walk `rows` in order (already newest-first); return the `LibraryVideo` for the first `row.videoId` found in `videosById`; return `null` if none resolve.
- This is the only new logic with branching worth testing. `HistoryRow` is imported from `@/db/history-repo`; `LibraryVideo` from `@/library/types`.

### Group lookup — reuse, no new module
- In `index.tsx`, the home screen already holds `groups` (from `useLibrary(mode)`). A small inline/`useMemo` lookup finds the group whose `items` contain the target id; `groupKey` is passed only when that group's `count > 1`.

### Component — `src/components/resume-fab.tsx` (new)
- `ResumeFab({ onPress }: { onPress: () => void })` — a themed Material You extended FAB (play icon + "Resume" text), absolutely positioned bottom-right with safe insets. Pure presentational; rendered by the home screen only when a target exists.

### Wiring — `src/app/index.tsx` (edit)
- On focus (reuse the existing `useFocusEffect` that already fetches progress), also fetch history rows and derive the resume target with `resolveLastPlayed(rows, videosById)` where `videosById` is built from the cached `videos`.
- Render `<ResumeFab onPress={...} />` over the list when the target is non-null.
- `onPress`: look up the target's group in `groups`, build the player params (with `groupKey`/`mode` iff multi-item group), `router.push`.

## Data flow

```
focus ──getHistory──▶ HistoryRow[] (last_played_at DESC)
                          │
useLibraryData().videos ──▶ Map<id, LibraryVideo>
                          │
                resolveLastPlayed(rows, byId) ──▶ target: LibraryVideo | null
                          │
            null ─────────┴──────────▶ FAB hidden
            non-null ─────────────────▶ FAB shown ("▶ Resume")
                          │ tap
            find group in groups containing target.id
                          │
         multi-item group? ──yes──▶ /player {videoId,uri,title,groupKey,mode}
                          └──no───▶ /player {videoId,uri,title}
                          │
              player resumes at saved watch_progress position
```

## Testing

- **Jest:** `resolveLastPlayed` — returns most-recent when it exists; skips a deleted most-recent and returns the next existing; returns `null` for empty rows and for all-deleted; maps to the correct `LibraryVideo`.
- **Device-verified (user build, JS-only — `expo start`, no native rebuild):** FAB appears only when there's resumable history; tap resumes the last video at position; on a grouped video (e.g. S01E02) next/prev work in the player; deleting the last-played video and reopening falls back to the next existing one; empty/all-deleted history hides the FAB.

## Files touched

- New: `src/player/resume-last.ts`, `src/player/__tests__/resume-last.test.ts`, `src/components/resume-fab.tsx`.
- Edit: `src/app/index.tsx` (focus fetch of history + target, render FAB, navigate with group context).

## Out of scope

- Auto-advancing to the next episode when the last video was finished (resumes the same video; manual next still works).
- Persisting/remembering the exact `mode` a video was originally launched from.
- A thumbnail or title on the FAB (plain extended FAB only).
