import type { SQLiteDatabase } from 'expo-sqlite';

interface PreviewFrameRow {
  idx: number;
  uri: string;
}

/** Completed frames for a video, keyed by slot index. */
export async function getPreviewFrames(
  db: SQLiteDatabase,
  videoId: string,
): Promise<Map<number, string>> {
  const rows = await db.getAllAsync<PreviewFrameRow>(
    'SELECT idx, uri FROM preview_frames WHERE video_id = ?',
    [videoId],
  );
  const map = new Map<number, string>();
  for (const r of rows) map.set(r.idx, r.uri);
  return map;
}

export async function insertPreviewFrame(
  db: SQLiteDatabase,
  videoId: string,
  idx: number,
  timeMs: number,
  uri: string,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO preview_frames (video_id, idx, time_ms, uri)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(video_id, idx) DO UPDATE SET uri = excluded.uri, time_ms = excluded.time_ms`,
    [videoId, idx, timeMs, uri],
  );
}

export async function deletePreviewFramesByIds(
  db: SQLiteDatabase,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM preview_frames WHERE video_id IN (${placeholders})`, ids);
}
