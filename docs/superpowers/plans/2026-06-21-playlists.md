# Playlists — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-created playlists with CRUD, add/remove videos, manual reorder, and player integration (next/prev within a playlist).

**Architecture:** Two new tables (`playlists`, `playlist_items`) via migration v4. A `playlists-repo` handles all DB ops. Two pure tested helpers (`pickStart`, `resolvePlaylistItems`). Three new screens (playlist list, playlist detail, video picker). The player gains a `playlistId` param for playlist-based neighbor resolution using the existing `neighbors()` function.

**Tech Stack:** Expo SDK 56 / React Native 0.85, expo-router, expo-sqlite, Jest for pure helpers.

## Global Constraints

- **Android-only**, Expo SDK 56. Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code if unsure.
- **Package manager is `bun`.** Tests: `npm test`. Typecheck: `npx tsc --noEmit` (must stay clean).
- **Commits are plain conventional commits — NO `Co-Authored-By` / "Generated with Claude Code" trailer.**
- **Testing convention (lean):** pure logic gets Jest tests; React/native UI is verified by `tsc` + the user's device build. UI tasks gate on `tsc`, not Jest.
- **No new native module** → JS-only; ships on `npx expo start` reload, no `expo run:android`.
- `colors` is a full Material3 scheme; existing code uses `?? fallback` defensively — keep that style.
- Types: `LibraryVideo` from `@/library/types`. Player params include `videoId`, `uri`, `title` and optional `groupKey`, `mode`. The `neighbors()` function in `@/player/playlist` is generic (`<T extends { id: string }>`).
- Screens wrap in `<Screen>` component; use `useSQLiteContext()` for DB, `useFocusEffect` for focus reload. Lists use `FlashList` or `SectionList`. Icons from `Ionicons`/`MaterialIcons`.
- Reuse existing components: `VideoThumbnail`, `ThumbnailCollage`, `DurationBadge`, `ProgressBar`, `SearchBar`, `Screen`, `PressableScale`.

---

### Task 1: Migration v4 — `playlists` + `playlist_items` tables

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Add migration v4**

  Add a new migration entry to the `MIGRATIONS` array with `version: 4`:
  ```ts
  {
    version: 4,
    up: `
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
    `,
  },
  ```
  Bump `LATEST_VERSION` to `4`.

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 3: Commit**

  `git commit -m "feat(db): migration v4 — playlists + playlist_items tables"`

---

### Task 2: Playlists repo

**Files:**
- Create: `src/db/playlists-repo.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase` from `expo-sqlite`.
- Produces: `createPlaylist`, `renamePlaylist`, `deletePlaylist`, `getAllPlaylists`, `getPlaylistItems`, `addItems`, `removeItem`, `reorderItems`.

- [ ] **Step 1: Create `src/db/playlists-repo.ts`**

  ```ts
  import type { SQLiteDatabase } from 'expo-sqlite';

  // ── Types ────────────────────────────────────────────────────────────────

  export interface PlaylistRow {
    id: string;
    name: string;
    createdAt: number;
    updatedAt: number;
    itemCount: number;
  }

  export interface PlaylistItemRow {
    videoId: string;
    sortOrder: number;
  }

  interface DbPlaylistRow {
    id: string;
    name: string;
    created_at: number;
    updated_at: number;
    item_count: number;
  }

  interface DbItemRow {
    video_id: string;
    sort_order: number;
  }

  // ── Playlist CRUD ────────────────────────────────────────────────────────

  export async function createPlaylist(
    db: SQLiteDatabase,
    name: string,
  ): Promise<PlaylistRow> {
    const id = crypto.randomUUID();
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO playlists (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [id, name, now, now],
    );
    return { id, name, createdAt: now, updatedAt: now, itemCount: 0 };
  }

  export async function renamePlaylist(
    db: SQLiteDatabase,
    id: string,
    name: string,
  ): Promise<void> {
    await db.runAsync(
      `UPDATE playlists SET name = ?, updated_at = ? WHERE id = ?`,
      [name, Date.now(), id],
    );
  }

  export async function deletePlaylist(
    db: SQLiteDatabase,
    id: string,
  ): Promise<void> {
    await db.runAsync(`DELETE FROM playlists WHERE id = ?`, [id]);
  }

  export async function getAllPlaylists(
    db: SQLiteDatabase,
  ): Promise<PlaylistRow[]> {
    const rows = await db.getAllAsync<DbPlaylistRow>(
      `SELECT p.id, p.name, p.created_at, p.updated_at,
              COUNT(pi.id) AS item_count
       FROM playlists p
       LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
       GROUP BY p.id
       ORDER BY p.updated_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      itemCount: r.item_count,
    }));
  }

  // ── Items ────────────────────────────────────────────────────────────────

  export async function getPlaylistItems(
    db: SQLiteDatabase,
    playlistId: string,
  ): Promise<PlaylistItemRow[]> {
    const rows = await db.getAllAsync<DbItemRow>(
      `SELECT video_id, sort_order FROM playlist_items
       WHERE playlist_id = ? ORDER BY sort_order ASC`,
      [playlistId],
    );
    return rows.map((r) => ({ videoId: r.video_id, sortOrder: r.sort_order }));
  }

  export async function addItems(
    db: SQLiteDatabase,
    playlistId: string,
    videoIds: string[],
  ): Promise<void> {
    if (videoIds.length === 0) return;
    const maxRow = await db.getFirstAsync<{ m: number | null }>(
      `SELECT MAX(sort_order) AS m FROM playlist_items WHERE playlist_id = ?`,
      [playlistId],
    );
    let nextOrder = (maxRow?.m ?? -1) + 1;
    const now = Date.now();
    for (const videoId of videoIds) {
      await db.runAsync(
        `INSERT OR IGNORE INTO playlist_items (id, playlist_id, video_id, sort_order, added_at)
         VALUES (?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), playlistId, videoId, nextOrder, now],
      );
      nextOrder++;
    }
    await db.runAsync(
      `UPDATE playlists SET updated_at = ? WHERE id = ?`,
      [now, playlistId],
    );
  }

  export async function removeItem(
    db: SQLiteDatabase,
    playlistId: string,
    videoId: string,
  ): Promise<void> {
    await db.runAsync(
      `DELETE FROM playlist_items WHERE playlist_id = ? AND video_id = ?`,
      [playlistId, videoId],
    );
    await db.runAsync(
      `UPDATE playlists SET updated_at = ? WHERE id = ?`,
      [Date.now(), playlistId],
    );
  }

  export async function reorderItems(
    db: SQLiteDatabase,
    playlistId: string,
    orderedVideoIds: string[],
  ): Promise<void> {
    for (let i = 0; i < orderedVideoIds.length; i++) {
      await db.runAsync(
        `UPDATE playlist_items SET sort_order = ? WHERE playlist_id = ? AND video_id = ?`,
        [i, playlistId, orderedVideoIds[i]],
      );
    }
    await db.runAsync(
      `UPDATE playlists SET updated_at = ? WHERE id = ?`,
      [Date.now(), playlistId],
    );
  }
  ```

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 3: Commit**

  `git commit -m "feat(db): playlists repo — CRUD + item management"`

---

### Task 3: Pure helpers — `resolvePlaylistItems` + `pickStart` + tests

**Files:**
- Create: `src/playlists/resolve-items.ts`
- Create: `src/playlists/pick-start.ts`
- Create: `src/playlists/__tests__/resolve-items.test.ts`
- Create: `src/playlists/__tests__/pick-start.test.ts`

#### 3a: `resolvePlaylistItems`

- [ ] **Step 1: Write the failing test** (`src/playlists/__tests__/resolve-items.test.ts`)

  ```ts
  import { resolvePlaylistItems } from '../resolve-items';
  import type { LibraryVideo } from '@/library/types';
  import type { PlaylistItemRow } from '@/db/playlists-repo';

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

  const item = (videoId: string, sortOrder: number): PlaylistItemRow => ({
    videoId,
    sortOrder,
  });

  const byId = (vids: LibraryVideo[]) => new Map(vids.map((v) => [v.id, v]));

  describe('resolvePlaylistItems', () => {
    it('joins items against the video cache in sort order', () => {
      const items = [item('b', 0), item('a', 1)];
      const result = resolvePlaylistItems(items, byId([vid('a'), vid('b')]));
      expect(result.map((v) => v.id)).toEqual(['b', 'a']);
    });

    it('drops items whose video was deleted', () => {
      const items = [item('a', 0), item('gone', 1), item('b', 2)];
      const result = resolvePlaylistItems(items, byId([vid('a'), vid('b')]));
      expect(result.map((v) => v.id)).toEqual(['a', 'b']);
    });

    it('returns empty array for no items', () => {
      expect(resolvePlaylistItems([], byId([vid('a')]))).toEqual([]);
    });

    it('returns empty array when all items deleted', () => {
      const items = [item('gone1', 0), item('gone2', 1)];
      expect(resolvePlaylistItems(items, byId([]))).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test -- resolve-items`
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/playlists/resolve-items.ts`**

  ```ts
  import type { LibraryVideo } from '@/library/types';
  import type { PlaylistItemRow } from '@/db/playlists-repo';

  /**
   * Join playlist item rows against the library video cache.
   * Drops items whose video no longer exists. Preserves sort order.
   */
  export function resolvePlaylistItems(
    items: PlaylistItemRow[],
    videosById: Map<string, LibraryVideo>,
  ): LibraryVideo[] {
    const result: LibraryVideo[] = [];
    for (const item of items) {
      const video = videosById.get(item.videoId);
      if (video) result.push(video);
    }
    return result;
  }
  ```

- [ ] **Step 4: Run tests — should pass**

  Run: `npm test -- resolve-items`
  Expected: PASS (4 tests).

#### 3b: `pickStart`

- [ ] **Step 5: Write the failing test** (`src/playlists/__tests__/pick-start.test.ts`)

  ```ts
  import { pickStart } from '../pick-start';

  const item = (id: string) => ({ id });

  describe('pickStart', () => {
    it('returns the first item when none are completed', () => {
      const result = pickStart([item('a'), item('b'), item('c')], new Set());
      expect(result?.id).toBe('a');
    });

    it('skips completed items and returns the first incomplete', () => {
      const result = pickStart(
        [item('a'), item('b'), item('c')],
        new Set(['a']),
      );
      expect(result?.id).toBe('b');
    });

    it('returns the first item when all are completed', () => {
      const result = pickStart(
        [item('a'), item('b')],
        new Set(['a', 'b']),
      );
      expect(result?.id).toBe('a');
    });

    it('returns null for an empty array', () => {
      expect(pickStart([], new Set())).toBeNull();
    });
  });
  ```

- [ ] **Step 6: Run test — should fail**

  Run: `npm test -- pick-start`
  Expected: FAIL — module not found.

- [ ] **Step 7: Implement `src/playlists/pick-start.ts`**

  ```ts
  /**
   * Pick the starting video for "Play All".
   * Returns the first item whose id is NOT in `completedIds`, or the first item
   * if all are completed. Returns null for an empty list.
   */
  export function pickStart<T extends { id: string }>(
    items: T[],
    completedIds: Set<string>,
  ): T | null {
    if (items.length === 0) return null;
    const first = items.find((it) => !completedIds.has(it.id));
    return first ?? items[0];
  }
  ```

- [ ] **Step 8: Run tests — should pass**

  Run: `npm test -- pick-start`
  Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

  `git commit -m "feat(playlists): pure helpers — resolvePlaylistItems + pickStart (tested)"`

---

### Task 4: Register new screens in `_layout.tsx`

**Files:**
- Modify: `src/app/_layout.tsx`

- [ ] **Step 1: Add three Stack.Screen entries**

  Inside the `<Stack>`, add:
  ```tsx
  <Stack.Screen name="playlists" />
  <Stack.Screen name="playlist" />
  <Stack.Screen name="add-to-playlist" />
  ```

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean (typed routes may warn until expo regenerates; acceptable).

- [ ] **Step 3: Commit**

  `git commit -m "feat(nav): register playlists screens in root layout"`

---

### Task 5: Playlists list screen (`/playlists`)

**Files:**
- Create: `src/app/playlists.tsx`
- Create: `src/components/playlist-row.tsx`

**Interfaces:**
- Consumes: `getAllPlaylists`, `deletePlaylist` from `@/db/playlists-repo`; `Screen`, `SearchBar`, `ThumbnailCollage`, `PressableScale` from components; `useTheme`, `useSQLiteContext`, `useFocusEffect`, `useRouter`.
- Produces: list screen with create, search, swipe-delete, navigate to detail.

- [ ] **Step 1: Create `src/components/playlist-row.tsx`**

  A row component for the playlists list:
  - Props: `{ playlist: PlaylistRow; thumbnails: (string | null)[]; onPress: () => void }`
  - Layout: `ThumbnailCollage` (left) + name + "N videos" subtitle (right).
  - `PressableScale` with `android_ripple`.
  - Themed colors from `useTheme()`.

- [ ] **Step 2: Create `src/app/playlists.tsx`**

  Screen layout:
  - `<Screen>` wrapper.
  - Header: back arrow + "Playlists" title + "+" create button (Ionicons `add`).
  - Create button: `Alert.prompt` (or custom text input alert) for playlist name → `createPlaylist(db, name)` → refetch.
  - `useFocusEffect`: `getAllPlaylists(db)` → state.
  - `FlashList` of `PlaylistRow` items.
  - Swipe-to-delete: `Swipeable` from RNGH or simple `Alert.alert` confirm on long-press → `deletePlaylist` → refetch.
  - Tap row: `router.push({ pathname: '/playlist', params: { id: playlist.id } })`.
  - Empty state: Ionicons `musical-notes-outline` + "No playlists yet" + "Tap + to create one".

  **Thumbnail collage for each playlist:** Build a lookup from `getPlaylistItems` for each playlist, join against the video cache to get `thumbUri` values. For efficiency, batch-load all playlist items on focus. Alternatively, do a single query joining `playlist_items` → `videos` for `thumb_uri` grouped by `playlist_id` (implementation decision at build time — keep it simple).

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 4: Commit**

  `git commit -m "feat(playlists): playlists list screen + playlist row component"`

---

### Task 6: Playlist detail screen (`/playlist`)

**Files:**
- Create: `src/app/playlist.tsx`
- Create: `src/components/playlist-item-row.tsx`

**Interfaces:**
- Consumes: `getPlaylistItems`, `renamePlaylist`, `deletePlaylist`, `removeItem`, `reorderItems` from repo; `resolvePlaylistItems` from helpers; `pickStart`; `getProgressMap`; `useLibraryData`; `useTheme`, `useSQLiteContext`, `useFocusEffect`, `useRouter`, `useLocalSearchParams`.
- Produces: detail screen with play-all, rename, delete, reorder, remove items, add videos.

- [ ] **Step 1: Create `src/components/playlist-item-row.tsx`**

  A row component for a video inside a playlist:
  - Props: `{ video: LibraryVideo; percent: number; onPress: () => void; renderDragHandle?: () => ReactNode }`
  - Layout: drag handle (≡) + `VideoThumbnail` (with duration badge) + filename + `ProgressBar`.
  - `PressableScale` for the row; drag handle is a separate touch target.

- [ ] **Step 2: Create `src/app/playlist.tsx`**

  Receives `{ id }` from `useLocalSearchParams`.

  Screen layout:
  - `<Screen>` wrapper.
  - Header: back arrow + playlist name (truncated) + action icons:
    - ▶ Play All (Ionicons `play`): `pickStart(items, completedIds)` → navigate to player with `playlistId`.
    - ✏️ Rename (MaterialIcons `edit`): `Alert.prompt` → `renamePlaylist` → refetch.
    - 🗑 Delete (Ionicons `trash-outline`): `Alert.alert` confirm → `deletePlaylist` → `router.back()`.
  - `useFocusEffect`: load `getPlaylistItems` + `getProgressMap`, resolve items via `resolvePlaylistItems`, load playlist name from `getAllPlaylists`.
  - List of `PlaylistItemRow` components.
  - Reorder: either `react-native-draggable-flatlist` (try first) or manual up/down buttons. On reorder complete → `reorderItems(db, id, newOrder)`.
  - Swipe-to-remove: `removeItem(db, playlistId, videoId)` → remove from local state.
  - Tap video → player: `router.push({ pathname: '/player', params: { videoId, uri, title, playlistId: id } })`.
  - Bottom "Add Videos" button: `router.push({ pathname: '/add-to-playlist', params: { playlistId: id } })`.
  - Empty state: Ionicons `list-outline` + "No videos yet" + "Add some videos to get started".

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 4: Commit**

  `git commit -m "feat(playlists): playlist detail screen with reorder + play all"`

---

### Task 7: Video picker screen (`/add-to-playlist`)

**Files:**
- Create: `src/app/add-to-playlist.tsx`

**Interfaces:**
- Consumes: `getPlaylistItems`, `addItems`, `removeItem` from repo; `useLibraryData`; `useFilterSettings` + `applyFilters`; `SearchBar`; `VideoThumbnail`, `Screen`; `useTheme`, `useSQLiteContext`, `useLocalSearchParams`, `useRouter`.
- Produces: full-screen video picker with checkboxes.

- [ ] **Step 1: Create `src/app/add-to-playlist.tsx`**

  Receives `{ playlistId }` from `useLocalSearchParams`.

  Screen layout:
  - `<Screen>` wrapper.
  - Header: back arrow + "Add to playlist" + "Done" text button.
  - `SearchBar` for filtering.
  - `FlashList` of all library videos (filtered by `applyFilters` + search query):
    - Each row: checkbox (filled/empty circle icon) + thumbnail + filename + duration.
    - Pre-checked if already in the playlist (from `getPlaylistItems`).
    - Toggle checkbox: add to / remove from local `selectedIds` set.
  - "Done" button: diff `selectedIds` vs `existingIds`:
    - New additions: `addItems(db, playlistId, newIds)`.
    - Removals: `removeItem(db, playlistId, removedId)` for each.
    - Navigate back.
  - Count indicator in Done button: "Done (3 added)" or "Done" if no changes.

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 3: Commit**

  `git commit -m "feat(playlists): video picker screen for adding videos to playlist"`

---

### Task 8: Player integration — `playlistId` param

**Files:**
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `getPlaylistItems` from repo; `resolvePlaylistItems`; `useLibraryData`; existing `neighbors()`.
- Produces: playlist-based next/prev when `playlistId` is present.

- [ ] **Step 1: Add `playlistId` to params type**

  In the `useLocalSearchParams` call, add `playlistId?: string`.

- [ ] **Step 2: Add playlist neighbor resolution**

  After the existing group neighbor resolution block (lines ~53–63), add playlist resolution that **takes priority** when `playlistId` is present:

  ```ts
  // ── Playlist neighbors (takes priority over group) ─────────────────────
  const [playlistItems, setPlaylistItems] = useState<LibraryVideo[]>([]);

  useEffect(() => {
    if (!playlistId) { setPlaylistItems([]); return; }
    getPlaylistItems(db, playlistId).then((rows) => {
      const byId = new Map(allVideos.map((v) => [v.id, v]));
      setPlaylistItems(resolvePlaylistItems(rows, byId));
    });
  }, [db, playlistId, allVideos]);

  const playlistNeighbors = playlistId && playlistItems.length > 0
    ? neighbors(playlistItems, videoId)
    : null;

  // Final prev/next: playlist takes priority, then group
  const { prev, next } = playlistNeighbors
    ?? (group ? neighbors(group.items, videoId) : { prev: null, next: null, index: -1 });
  ```

  This replaces the current bare `const { prev, next } = ...` line. The existing `group` resolution stays but is used as a fallback.

- [ ] **Step 3: Verify existing functionality untouched**

  When `playlistId` is absent (the normal case), `playlistNeighbors` is null, and the existing group-based resolution runs unchanged.

- [ ] **Step 4: Typecheck + full test suite**

  Run: `npx tsc --noEmit` + `npm test`
  Expected: both clean/pass.

- [ ] **Step 5: Commit**

  `git commit -m "feat(player): support playlistId param for playlist-based next/prev"`

---

### Task 9: Home screen — playlists icon button

**Files:**
- Modify: `src/app/index.tsx`

- [ ] **Step 1: Add playlists icon to the header pill**

  In the header `View` (around line 133), add a `Link` to `/playlists` with a `list-outline` Ionicons icon, positioned alongside the history and settings icons:

  ```tsx
  <Link href="/playlists" style={{ padding: 4 }}>
    <Ionicons name="list-outline" size={20} color={colors.onSurface} />
  </Link>
  ```

  Place it between the history icon and the settings icon.

- [ ] **Step 2: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 3: Commit**

  `git commit -m "feat(home): add playlists icon to header"`

---

### Task 10: Final check + commit

- [ ] `npm test` — all suites pass including `resolve-items` and `pick-start`.
- [ ] `npx tsc --noEmit` — clean.
- [ ] `git log --oneline` — plain commits, no `Co-Authored-By` trailer.
- [ ] Review: all screens render correctly (verified by tsc + structure review).

**Build note:** JS-only change — `npx expo start` + reload is sufficient, no native rebuild needed. **Exception:** if `react-native-draggable-flatlist` is used and contains native code, a rebuild would be needed. Verify at install time; if native, fall back to manual reorder buttons.

## Verification checklist (for the user's device test)

- [ ] Playlists icon visible in home header; tapping opens `/playlists`.
- [ ] Can create a new playlist (name prompt → appears in list).
- [ ] Can rename and delete a playlist from the detail screen.
- [ ] "Add Videos" picker shows all library videos with checkboxes; can add/remove.
- [ ] Playlist detail shows videos with thumbnails, duration badges, progress bars.
- [ ] Can reorder videos (drag or manual buttons).
- [ ] Swipe-to-remove removes from playlist (not from library).
- [ ] Tapping a video opens the player with playlist next/prev working.
- [ ] "Play All" starts from the first unfinished video.
- [ ] Deleting a video from device → it disappears from playlists on next scan.
- [ ] Empty playlist shows empty state with "Add Videos" prompt.
- [ ] Empty playlists list shows empty state with "Tap + to create one".

## Spec coverage check

| Spec section | Task |
|---|---|
| §4 Data model (migration) | Task 1 |
| §4.2 Repo | Task 2 |
| §6.1 Pure helpers | Task 3 |
| §3b Playlists list screen | Task 5 |
| §3c Playlist detail screen | Task 6 |
| §3d Video picker screen | Task 7 |
| §5 Player integration | Task 8 |
| §3a Home entry point | Task 9 |
| §6.5 Navigation changes | Task 4 |
| §7 Edge cases | Tasks 5–8 (handled in each screen) |

All spec sections mapped.
