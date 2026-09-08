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

export async function deleteMoment(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM moments WHERE id = ?', [id]);
}

/**
 * Swap the whole table for a restored set. Used by the Phase 3 restore flow,
 * which only ever runs against an empty table, but clearing first keeps it
 * idempotent if a restore is ever offered twice.
 */
export async function replaceAllMoments(
  db: SQLiteDatabase,
  moments: Moment[],
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM moments');
    for (const moment of moments) {
      await db.runAsync(INSERT_SQL, toParams(moment));
    }
  });
}
