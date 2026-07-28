import type { SQLiteDatabase } from 'expo-sqlite';
import type { ProgressWrite } from '@/player/progress-writer';

export interface ProgressEntry {
  positionMs: number;
  percent: number;
}
export type ProgressMap = Map<string, ProgressEntry>;

interface ProgressRow {
  video_id: string;
  position_ms: number;
  percent: number;
}

export async function getProgressMap(db: SQLiteDatabase): Promise<ProgressMap> {
  const rows = await db.getAllAsync<ProgressRow>(
    'SELECT video_id, position_ms, percent FROM watch_progress',
  );
  const map: ProgressMap = new Map();
  for (const r of rows) map.set(r.video_id, { positionMs: r.position_ms, percent: r.percent });
  return map;
}

export async function upsertProgress(
  db: SQLiteDatabase,
  videoId: string,
  w: ProgressWrite,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO watch_progress (video_id, position_ms, percent, completed, last_played_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET
       position_ms = excluded.position_ms,
       percent = excluded.percent,
       completed = excluded.completed,
       last_played_at = excluded.last_played_at`,
    [videoId, w.positionMs, w.percent, w.completed ? 1 : 0, w.lastPlayedAt],
  );
}

export async function deleteProgressByIds(db: SQLiteDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM watch_progress WHERE video_id IN (${placeholders})`, ids);
}

export async function getDisplayMode(
  db: SQLiteDatabase,
  videoId: string,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ display_mode: string | null }>(
    'SELECT display_mode FROM watch_progress WHERE video_id = ?',
    [videoId],
  );
  return row?.display_mode ?? null;
}

// Upsert: a fresh video may have no progress row yet (last_played_at is NOT
// NULL, hence nowMs). Progress writes name their columns in ON CONFLICT, so
// they never clobber display_mode and vice versa.
export async function setDisplayMode(
  db: SQLiteDatabase,
  videoId: string,
  mode: string | null,
  nowMs: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO watch_progress (video_id, position_ms, percent, completed, last_played_at, display_mode)
     VALUES (?, 0, 0, 0, ?, ?)
     ON CONFLICT(video_id) DO UPDATE SET display_mode = excluded.display_mode`,
    [videoId, nowMs, mode],
  );
}
