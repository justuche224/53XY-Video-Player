import type { SQLiteDatabase } from 'expo-sqlite';

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
