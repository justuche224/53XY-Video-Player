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

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function createPlaylist(
  db: SQLiteDatabase,
  name: string,
): Promise<PlaylistRow> {
  const id = uuidv4();
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
      [uuidv4(), playlistId, videoId, nextOrder, now],
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
