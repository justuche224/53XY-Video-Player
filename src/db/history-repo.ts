import type { SQLiteDatabase } from 'expo-sqlite';

export interface HistoryRow {
  videoId: string;
  positionMs: number;
  percent: number;
  completed: boolean;
  lastPlayedAt: number;
}

interface HistoryDbRow {
  video_id: string;
  position_ms: number;
  percent: number;
  completed: number;
  last_played_at: number;
}

export async function getHistory(db: SQLiteDatabase): Promise<HistoryRow[]> {
  const rows = await db.getAllAsync<HistoryDbRow>(
    `SELECT video_id, position_ms, percent, completed, last_played_at
     FROM watch_progress
     ORDER BY last_played_at DESC`,
  );
  return rows.map((r) => ({
    videoId: r.video_id,
    positionMs: r.position_ms,
    percent: r.percent,
    completed: r.completed === 1,
    lastPlayedAt: r.last_played_at,
  }));
}

export async function removeHistory(db: SQLiteDatabase, videoId: string): Promise<void> {
  await db.runAsync('DELETE FROM watch_progress WHERE video_id = ?', [videoId]);
}

export async function clearHistory(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM watch_progress');
}
