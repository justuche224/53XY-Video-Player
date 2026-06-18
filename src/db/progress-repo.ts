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
