# Playlists — Design Spec

_Status: ready for approval. Major v2 feature. Date: 2026-06-21._

## 1 · Goal

User-created **playlists** with full CRUD (create, rename, delete), add/remove videos, manual
reorder (drag-to-sort), and seamless playback integration — tap a video in a playlist to play
through the entire list with next/prev, reusing the existing `neighbors()` function and player
`setParams` pattern.

## 2 · Non-goals (v1 of playlists)

- Smart/auto playlists (e.g. "all videos > 30 min").
- Import/export.
- Custom cover art (we use auto-generated thumbnail collage).
- Shuffle / repeat / loop modes.
- Sharing playlists.
- Resume FAB awareness of playlist context (FAB still resumes the most-recent video; it just
  won't have playlist next/prev — acceptable).

## 3 · UI

### 3a · Home screen — playlists entry
```
┌──────────────────────────────────────────┐
│  53XY                    🕐  📋  ⚙️  🔍 │  ← 📋 = playlists button (new)
│  [Videos] [Folders]                      │
│  ...library...                           │
│                           ┌────────────┐ │
│                           │ ▶  Resume  │ │
│                           └────────────┘ │
└──────────────────────────────────────────┘
```
Tapping 📋 (`list-outline` Ionicons) navigates to `/playlists`.

### 3b · Playlists list screen (`/playlists`)
```
┌──────────────────────────────────────────┐
│  ←  Playlists                     ＋     │  ← + button creates new playlist
│                                          │
│  ┌──────┐                                │
│  │collge│ My Workout Videos    5 videos  │  ← tap → playlist detail
│  └──────┘                                │
│  ┌──────┐                                │
│  │collge│ Watch Later          12 videos │
│  └──────┘                                │
│  ┌──────┐                                │
│  │collge│ Movie Marathon       3 videos  │
│  └──────┘                                │
│                                          │
│           (empty state if none)          │
└──────────────────────────────────────────┘
```
- Each row: thumbnail collage (reuse `ThumbnailCollage` from up to 4 items), name, item count.
- Swipe-to-delete with confirmation alert.
- Empty state: icon + "No playlists yet" + "Tap + to create one".

### 3c · Playlist detail screen (`/playlist?id=...`)
```
┌──────────────────────────────────────────┐
│  ←  My Workout Videos  ▶ Play All  ✏️ 🗑│  ← play-all, rename, delete
│                                          │
│  ┌──────┐                                │
│  │thumb │ ≡  Push Day Routine    30:00   │  ← ≡ drag handle for reorder
│  └──────┘                                │
│  ┌──────┐                                │
│  │thumb │ ≡  Pull Day Routine    28:15   │  ← swipe to remove from playlist
│  └──────┘                                │
│  ┌──────┐                                │
│  │thumb │ ≡  Leg Day             35:42   │
│  └──────┘                                │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │        ＋ Add Videos                 ││  ← opens video picker
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
- Rows show thumbnail + title + duration badge + progress bar (from `watch_progress`).
- Drag handle (`≡`) for manual reorder — on drag-end, persist new order.
- Swipe-to-remove: removes from playlist only, doesn't delete the video.
- "Play All" starts from the first unfinished video (or first video if all finished).
- Tap any video → player with `playlistId` context (next/prev within playlist).
- "+" button at the bottom opens the video picker.
- Header actions: rename (✏️ → text input alert) and delete (🗑 → confirmation).

### 3d · Video picker screen (`/add-to-playlist?playlistId=...`)
```
┌──────────────────────────────────────────┐
│  ←  Add to playlist               Done  │
│  ┌──────────────────────────────────────┐│
│  │ 🔍 Search videos...                 ││
│  └──────────────────────────────────────┘│
│                                          │
│  ☑  Push Day Routine         (already)   │  ← pre-checked, already in playlist
│  ☐  New Video A              30:00       │  ← toggle to add
│  ☐  New Video B              15:20       │
│  ☑  Pull Day Routine         (already)   │
│  ☐  New Video C              22:10       │
│                                          │
│  ┌──────────────────────────────────────┐│
│  │            Done (2 added)            ││  ← bottom confirm button
│  └──────────────────────────────────────┘│
└──────────────────────────────────────────┘
```
- Shows all library videos (respecting current filters from `FilterSettingsProvider`).
- Search to filter.
- Checkboxes: pre-checked for videos already in the playlist. Toggle to add/remove.
- "Done" button at the bottom: bulk inserts newly-checked videos at end, bulk removes
  newly-unchecked videos, then navigates back.

### 3e · Adding from library — long-press bottom sheet (DEFERRED)
Long-press on a video in the library to add to a playlist via bottom sheet. This is nice UX
but adds complexity (action sheet, playlist selection submenu). **Deferred to a follow-up.**
Users can add videos from within the playlist detail screen's "Add Videos" picker.

## 4 · Data model

### 4.1 New tables (migration v4)

```sql
CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY NOT NULL,
  playlist_id TEXT NOT NULL,
  video_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pi_playlist ON playlist_items(playlist_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pi_unique ON playlist_items(playlist_id, video_id);
```

- `playlists.id`: UUID (`crypto.randomUUID()`).
- `playlist_items.id`: UUID.
- Timestamps are `INTEGER` (epoch ms), consistent with `videos.created_at` / `watch_progress.last_played_at`.
- `ON DELETE CASCADE` on both FKs: deleting a playlist removes its items; deleting a video
  (during library rescan) removes it from all playlists automatically.
- `UNIQUE(playlist_id, video_id)` prevents duplicate entries in the same playlist.

### 4.2 Repo: `src/db/playlists-repo.ts`

```ts
// Playlist CRUD
createPlaylist(db, name: string): Promise<PlaylistRow>
renamePlaylist(db, id: string, name: string): Promise<void>
deletePlaylist(db, id: string): Promise<void>
getAllPlaylists(db): Promise<PlaylistRow[]>

// Items
getPlaylistItems(db, playlistId: string): Promise<PlaylistItemRow[]>
addItems(db, playlistId: string, videoIds: string[]): Promise<void>
removeItem(db, playlistId: string, videoId: string): Promise<void>
reorderItems(db, playlistId: string, orderedVideoIds: string[]): Promise<void>

// Types
interface PlaylistRow {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  itemCount: number;      // derived from COUNT in getAllPlaylists query
}

interface PlaylistItemRow {
  videoId: string;
  sortOrder: number;
}
```

`getAllPlaylists` uses a LEFT JOIN + COUNT to include `itemCount` in one query.
`getPlaylistItems` returns `videoId + sortOrder` ordered by `sort_order ASC`. The caller
joins against the in-memory video cache to get full `LibraryVideo` objects (same pattern as
history: display-time join, drop items whose video was deleted mid-session).

`addItems` appends new items with `sort_order = MAX(sort_order) + 1, +2, ...`.
`reorderItems` bulk-updates `sort_order` for each video ID in the given order (transaction).

## 5 · Player integration

### 5.1 New route param: `playlistId`

Add to the player's `useLocalSearchParams`:
```ts
const { videoId, uri, title, groupKey, mode, playlistId } = useLocalSearchParams<{
  videoId: string;
  uri: string;
  title: string;
  groupKey?: string;
  mode?: string;
  playlistId?: string;  // NEW
}>();
```

### 5.2 Neighbor resolution

When `playlistId` is present (**takes priority** over `groupKey`/`mode`):
1. `getPlaylistItems(db, playlistId)` → `PlaylistItemRow[]` (ordered by `sort_order`).
2. Join against the in-memory video cache to get `LibraryVideo[]`.
3. Call `neighbors(items, videoId)` — the existing generic function works unchanged.
4. `prev`/`next` navigate within the playlist order.

When `playlistId` is absent, existing `groupKey`/`mode` logic continues unchanged.

### 5.3 Navigation from playlist detail

```ts
router.push({
  pathname: '/player',
  params: {
    videoId: video.id,
    uri: video.uri,
    title: video.filename,
    playlistId: playlist.id,
  },
});
```

No `groupKey`/`mode` — player sees `playlistId` and uses playlist-based neighbors.
`playlistId` persists across `router.setParams()` calls (same as `groupKey` today).

### 5.4 "Play All" behavior

1. Load progress map via `getProgressMap(db)`.
2. Find the first playlist item where `!isCompleted(progress.percent)`.
3. If all completed, start from the first item.
4. Navigate to player with that item + `playlistId`.

## 6 · Architecture

### 6.1 Pure helpers (Jest-tested)

#### `src/playlists/pick-start.ts`
```ts
pickStart<T extends { id: string }>(
  items: T[],
  completedIds: Set<string>,
): T | null
```
Returns the first item whose `id` is not in `completedIds`, or the first item if all are
completed. Returns `null` for empty array.

#### `src/playlists/resolve-items.ts`
```ts
resolvePlaylistItems(
  itemRows: PlaylistItemRow[],
  videosById: Map<string, LibraryVideo>,
): LibraryVideo[]
```
Joins `PlaylistItemRow[]` against the video cache. Drops items whose video no longer exists.
Returns `LibraryVideo[]` in `sort_order` order.

### 6.2 Screens

| Screen | Route | File |
|--------|-------|------|
| Playlists list | `/playlists` | `src/app/playlists.tsx` |
| Playlist detail | `/playlist` | `src/app/playlist.tsx` |
| Video picker | `/add-to-playlist` | `src/app/add-to-playlist.tsx` |

### 6.3 Components

| Component | File | Purpose |
|-----------|------|---------|
| `PlaylistRow` | `src/components/playlist-row.tsx` | Row in playlists list (collage, name, count) |
| `PlaylistItemRow` | `src/components/playlist-item-row.tsx` | Draggable row in detail (thumbnail, title, handle) |

### 6.4 Drag-to-reorder

Use a simple manual approach: each item row has an `≡` drag handle. Long-press the handle
to start dragging; on release, persist the new order. Implementation options:
1. **`react-native-draggable-flatlist`** — mature, uses RNGH + Reanimated (already deps).
   Need to verify RN 0.85 / new-arch compat.
2. **Fallback: move-up/move-down buttons** — if the drag lib isn't compatible, add ↑/↓
   buttons per row instead. Less slick but zero new deps.

**Decision at implementation time:** try option 1 first; fall back to option 2 if it doesn't
work on new-arch. Either way, reorder persists via `reorderItems()`.

**Native dep note:** `react-native-draggable-flatlist` is a JS library wrapping RNGH +
Reanimated (both already native deps). If it has no native code of its own, it's JS-only
(no rebuild). Verify at install time.

### 6.5 Navigation changes

Add three new `Stack.Screen` entries in `_layout.tsx`:
```tsx
<Stack.Screen name="playlists" />
<Stack.Screen name="playlist" />
<Stack.Screen name="add-to-playlist" />
```

Add a playlists icon button to the home screen header (alongside history + settings + search).

## 7 · Edge cases

- **Video deleted from device**: `ON DELETE CASCADE` on `playlist_items(video_id)` removes it
  from all playlists on next library rescan (when `deleteVideosByIds` runs). Mid-session,
  `resolvePlaylistItems` drops it from display.
- **Empty playlist**: show empty state with "Add Videos" button.
- **Duplicate add attempt**: `UNIQUE(playlist_id, video_id)` index prevents duplicates at the
  DB level; the picker UI pre-checks already-present videos.
- **Playlist with 1 item**: plays with no next/prev (matches standalone behavior).
- **Rename to empty string**: disable save button when input is empty.
- **Delete playlist**: confirmation alert → `deletePlaylist` → navigate back.
- **All items deleted mid-session**: detail screen shows empty state on re-focus.
- **Create playlist with same name as existing**: allowed (no unique constraint on name).

## 8 · Data flow

```
Home header 📋 ──push──▶ /playlists
                             │
              getAllPlaylists ──▶ PlaylistRow[] (with itemCount)
                             │
              tap ──push──▶ /playlist?id=...
                             │
              getPlaylistItems ──▶ PlaylistItemRow[]
              videosById (cache) ──▶ resolvePlaylistItems → LibraryVideo[]
                             │
              tap video ──push──▶ /player { videoId, uri, title, playlistId }
                             │
              player: getPlaylistItems + resolvePlaylistItems → neighbors()
                             │
              ▶ Play All: pickStart(items, completedIds) → /player { ..., playlistId }
```

## 9 · Testing

- **Pure helpers** (`pickStart`, `resolvePlaylistItems`): Jest unit tests.
- **Repo functions**: simple SQL, verified via device testing (lean convention).
- **Screens, drag-to-reorder, player integration**: device verification.

## 10 · Files touched

**New:**
- `src/db/playlists-repo.ts`
- `src/playlists/pick-start.ts` + `__tests__/pick-start.test.ts`
- `src/playlists/resolve-items.ts` + `__tests__/resolve-items.test.ts`
- `src/app/playlists.tsx`
- `src/app/playlist.tsx`
- `src/app/add-to-playlist.tsx`
- `src/components/playlist-row.tsx`
- `src/components/playlist-item-row.tsx`

**Edit:**
- `src/db/schema.ts` — migration v4 (playlists + playlist_items tables + indexes)
- `src/app/player.tsx` — accept `playlistId` param, resolve playlist neighbors
- `src/app/_layout.tsx` — register three new Stack screens
- `src/app/index.tsx` — add playlists icon button to header
