import type { SQLiteDatabase } from 'expo-sqlite';

/** Thumbnail bookkeeping for one video, as stored on the `videos` row. */
export interface ThumbState {
  uri: string | null;
  /** THUMB_VERSION this thumbnail was produced by; older means stale. */
  version: number;
  /** Consecutive failed extraction attempts at the current version. */
  attempts: number;
  /** Position the winning frame was taken from, so other sizes can match it. */
  timeMs: number | null;
}

interface ThumbDbRow {
  id: string;
  thumb_uri: string | null;
  thumb_version: number;
  thumb_attempts: number;
  thumb_time_ms: number | null;
}

const toState = (r: Omit<ThumbDbRow, 'id'>): ThumbState => ({
  uri: r.thumb_uri,
  version: r.thumb_version,
  attempts: r.thumb_attempts,
  timeMs: r.thumb_time_ms,
});

export async function getThumbStates(db: SQLiteDatabase): Promise<Map<string, ThumbState>> {
  const rows = await db.getAllAsync<ThumbDbRow>(
    'SELECT id, thumb_uri, thumb_version, thumb_attempts, thumb_time_ms FROM videos',
  );
  return new Map(rows.map((r) => [r.id, toState(r)]));
}

export async function getThumbState(
  db: SQLiteDatabase,
  id: string,
): Promise<ThumbState | undefined> {
  const row = await db.getFirstAsync<Omit<ThumbDbRow, 'id'>>(
    'SELECT thumb_uri, thumb_version, thumb_attempts, thumb_time_ms FROM videos WHERE id = ?',
    [id],
  );
  return row ? toState(row) : undefined;
}

export async function setThumbResult(
  db: SQLiteDatabase,
  id: string,
  uri: string,
  positionMs: number,
  version: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE videos
        SET thumb_uri = ?, thumb_time_ms = ?, thumb_version = ?, thumb_attempts = 0
      WHERE id = ?`,
    [uri, positionMs, version, id],
  );
}

/**
 * Counts a failed extraction. A version bump restarts the count, so a new
 * algorithm always gets a fresh set of attempts on a file that defeated the old one.
 */
export async function recordThumbFailure(
  db: SQLiteDatabase,
  id: string,
  version: number,
): Promise<void> {
  await db.runAsync(
    `UPDATE videos
        SET thumb_attempts = CASE WHEN thumb_version = ? THEN thumb_attempts + 1 ELSE 1 END,
            thumb_version = ?
      WHERE id = ?`,
    [version, version, id],
  );
}
