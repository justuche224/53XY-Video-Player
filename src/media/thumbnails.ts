import { getThumbnailAsync } from 'expo-video-thumbnails';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { LibraryVideo } from '@/library/types';
import { setThumbUri } from '@/db/videos-repo';
import { pLimit } from '@/lib/p-limit';

const limit = pLimit(3);

export async function getOrCreateThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
): Promise<string | null> {
  if (video.thumbUri) return video.thumbUri;
  return limit(async () => {
    try {
      const { uri } = await getThumbnailAsync(video.uri, { time: 3000, quality: 0.7 });
      await setThumbUri(db, video.id, uri);
      return uri;
    } catch {
      return null;
    }
  });
}
