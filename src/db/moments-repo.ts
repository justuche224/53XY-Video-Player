import type { SQLiteDatabase } from 'expo-sqlite';

import type { Moment } from '@/moments/types';

interface MomentDbRow {
  id: string;
  video_id: string | null;
  position_ms: number;
  created_at: number;
  frame_uri: string | null;
  note: string | null;
  title: string;
  episode_label: string | null;
  filename: string;
  folder: string | null;
  video_uri: string | null;
  duration_ms: number | null;
}

const COLUMNS = `id, video_id, position_ms, created_at, frame_uri, note,
                 title, episode_label, filename, folder, video_uri, duration_ms`;

function fromRow(r: MomentDbRow): Moment {
  return {
    id: r.id,
    videoId: r.video_id,
    positionMs: r.position_ms,
    createdAt: r.created_at,
    frameUri: r.frame_uri,
    note: r.note,
    title: r.title,
    episodeLabel: r.episode_label,
    filename: r.filename,
    folder: r.folder,
    videoUri: r.video_uri,
    durationMs: r.duration_ms,
  };
}

function toParams(m: Moment): (string | number | null)[] {
  return [
    m.id,
    m.videoId,
    m.positionMs,
    m.createdAt,
    m.frameUri,
    m.note,
    m.title,
    m.episodeLabel,
    m.filename,
    m.folder,
    m.videoUri,
    m.durationMs,
  ];
}

const INSERT_SQL = `INSERT INTO moments (${COLUMNS})
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function insertMoment(db: SQLiteDatabase, moment: Moment): Promise<void> {
  await db.runAsync(INSERT_SQL, toParams(moment));
}

/** Newest first — the order the Moments tab renders. */
export async function getMoments(db: SQLiteDatabase): Promise<Moment[]> {
  const rows = await db.getAllAsync<MomentDbRow>(
    `SELECT ${COLUMNS} FROM moments ORDER BY created_at DESC`,
  );
  return rows.map(fromRow);
}

/** Ascending by position — the order the seekbar draws its ticks. */
export async function getMomentsForVideo(
  db: SQLiteDatabase,
  videoId: string,
): Promise<Moment[]> {
  const rows = await db.getAllAsync<MomentDbRow>(
    `SELECT ${COLUMNS} FROM moments WHERE video_id = ? ORDER BY position_ms`,
    [videoId],
  );
  return rows.map(fromRow);
}

export async function updateMomentNote(
  db: SQLiteDatabase,
  id: string,
  note: string | null,
): Promise<void> {
  await db.runAsync('UPDATE moments SET note = ? WHERE id = ?', [note, id]);
}

export async function updateMomentFrameUri(
  db: SQLiteDatabase,
  id: string,
  frameUri: string,
): Promise<void> {
  await db.runAsync('UPDATE moments SET frame_uri = ? WHERE id = ?', [frameUri, id]);
}

/**
 * Point a moment at the video it was relinked to. Called after
 * `resolveMomentTarget` returns `relinked`, so the next play is an exact hit
 * rather than another filename search.
 */
export async function updateMomentVideoLink(
  db: SQLiteDatabase,
  id: string,
  videoId: string,
  videoUri: string,
): Promise<void> {
  await db.runAsync('UPDATE moments SET video_id = ?, video_uri = ? WHERE id = ?', [
    videoId,
    videoUri,
    id,
  ]);
}

export async function deleteMoments(db: SQLiteDatabase, ids: string[]): Promise<void> {
  // `IN ()` with no values is a syntax error, not an empty match.
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM moments WHERE id IN (${placeholders})`, ids);
}
