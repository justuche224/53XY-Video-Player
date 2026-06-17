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
           (id, uri, filename, duration_ms, size_bytes, width, height, folder, modified_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           uri = excluded.uri,
           filename = excluded.filename,
           duration_ms = excluded.duration_ms,
           width = excluded.width,
           height = excluded.height,
           folder = excluded.folder,
           modified_at = excluded.modified_at,
           created_at = excluded.created_at`,
        [r.id, r.uri, r.filename, r.duration_ms, r.size_bytes, r.width, r.height, r.folder, r.modified_at, r.created_at],
      );
    }
  });
}

export async function getAllVideos(db: SQLiteDatabase): Promise<LibraryVideo[]> {
  const rows = await db.getAllAsync<VideoRow>('SELECT * FROM videos');
  return rows.map(fromVideoRow);
}
