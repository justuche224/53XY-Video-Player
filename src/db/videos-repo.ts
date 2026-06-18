import type { SQLiteDatabase } from 'expo-sqlite';

import type { LibraryVideo } from '@/library/types';
import { fromVideoRow, toVideoRow, type VideoRow } from './video-row';

export async function upsertVideos(db: SQLiteDatabase, videos: LibraryVideo[]): Promise<void> {
  if (videos.length === 0) return;
  await db.withTransactionAsync(async () => {
    for (const video of videos) {
      const r = toVideoRow(video);
      await db.runAsync(
        `INSERT INTO videos
           (id, uri, filename, duration_ms, size_bytes, width, height, folder, thumb_uri, modified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           uri = excluded.uri,
           filename = excluded.filename,
           duration_ms = excluded.duration_ms,
           size_bytes = excluded.size_bytes,
           width = excluded.width,
           height = excluded.height,
           folder = excluded.folder,
           modified_at = excluded.modified_at,
           created_at = excluded.created_at`,
        [r.id, r.uri, r.filename, r.duration_ms, r.size_bytes, r.width, r.height, r.folder, r.thumb_uri, r.modified_at, r.created_at],
      );
    }
  });
}

export async function getAllVideos(db: SQLiteDatabase): Promise<LibraryVideo[]> {
  const rows = await db.getAllAsync<VideoRow>('SELECT * FROM videos');
  return rows.map(fromVideoRow);
}

export async function deleteVideosByIds(db: SQLiteDatabase, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM videos WHERE id IN (${placeholders})`, ids);
}

export async function setThumbUri(db: SQLiteDatabase, id: string, uri: string): Promise<void> {
  await db.runAsync('UPDATE videos SET thumb_uri = ? WHERE id = ?', [uri, id]);
}
