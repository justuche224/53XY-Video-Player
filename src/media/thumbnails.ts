import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getThumbState, recordThumbFailure, setThumbResult } from '@/db/thumbs-repo';
import type { LibraryVideo } from '@/library/types';
import { pLimit } from '@/lib/p-limit';
import { FrameGrabber } from '@/native/frame-grabber';
import {
  candidatePositions,
  needsThumbnail,
  thumbFileName,
  THUMB_MIN_SCORE,
  THUMB_QUALITY_CARD,
  THUMB_QUALITY_HERO,
  THUMB_VERSION,
  THUMB_WIDTH_CARD,
} from './thumb-policy';

/**
 * Thumbnails live in the *document* directory, not the cache: Android evicts
 * cached files under storage pressure, which is how a stored uri could end up
 * pointing at nothing.
 */
const THUMB_DIR = 'thumbnails';

/** Shared with the background sweep, so total extraction concurrency stays bounded. */
const limit = pLimit(3);

function thumbFile(videoId: string, width: number): File {
  return new File(new Directory(Paths.document, THUMB_DIR), thumbFileName(videoId, width));
}

function ensureThumbDir(): void {
  const dir = new Directory(Paths.document, THUMB_DIR);
  if (!dir.exists) dir.create();
}

/** True when a thumbnail of this size is already on disk. */
export function hasThumbnailFile(videoId: string, width: number = THUMB_WIDTH_CARD): boolean {
  return thumbFile(videoId, width).exists;
}

/**
 * Returns a usable thumbnail uri, extracting one if needed.
 *
 * Non-card sizes (the hero banner) reuse the position the card frame won on, so
 * the two never show different moments, and they never write back to the videos
 * row — `thumb_uri` always means the card-sized file.
 */
export async function getOrCreateThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
  width: number = THUMB_WIDTH_CARD,
): Promise<string | null> {
  return limit(async () => {
    const file = thumbFile(video.id, width);
    const state = await getThumbState(db, video.id);
    const isCard = width === THUMB_WIDTH_CARD;

    if (file.exists && !needsThumbnail(state, true)) return file.uri;
    // Nothing to regenerate and nothing on disk — this video has defeated us.
    if (!needsThumbnail(state, file.exists)) return file.exists ? file.uri : null;

    ensureThumbDir();

    // The card frame already picked a good moment; match it rather than re-scoring.
    const positionsMs =
      !isCard && state?.timeMs != null ? [state.timeMs] : candidatePositions(video.durationMs);

    try {
      const result = await FrameGrabber.grabFrame(video.uri, {
        positionsMs,
        targetWidth: width,
        minScore: THUMB_MIN_SCORE,
        quality: isCard ? THUMB_QUALITY_CARD : THUMB_QUALITY_HERO,
        outPath: file.uri,
      });
      if (!result) {
        if (isCard) await recordThumbFailure(db, video.id, THUMB_VERSION);
        return null;
      }
      if (isCard) {
        await setThumbResult(db, video.id, result.uri, result.positionMs, THUMB_VERSION);
      }
      return result.uri;
    } catch {
      if (isCard) await recordThumbFailure(db, video.id, THUMB_VERSION);
      return null;
    }
  });
}
