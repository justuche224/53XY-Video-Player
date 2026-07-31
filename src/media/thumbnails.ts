import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getThumbState, recordThumbFailure, setThumbResult } from '@/db/thumbs-repo';
import type { LibraryVideo } from '@/library/types';
import { pLimit } from '@/lib/p-limit';
import { FrameGrabber } from '@/native/frame-grabber';
import {
  candidatePositions,
  decideThumbAction,
  siblingWidthsToDelete,
  thumbFileName,
  THUMB_MIN_SCORE,
  THUMB_QUALITY_CARD,
  THUMB_QUALITY_HERO,
  THUMB_VERSION,
  THUMB_WIDTH_CARD,
  THUMB_WIDTH_HERO,
} from './thumb-policy';

/**
 * Thumbnails live in the *document* directory, not the cache: Android evicts
 * cached files under storage pressure, which is how a stored uri could end up
 * pointing at nothing.
 */
const THUMB_DIR = 'thumbnails';

/** Shared with the background sweep, so total extraction concurrency stays bounded. */
const limit = pLimit(3);

/**
 * Only non-card size today. The card path deletes files in this list whenever it
 * writes a new frame, so a version bump or a corrected card frame propagates to
 * every other size without any of them writing to the `videos` row. Add future
 * sizes here.
 */
const OTHER_WIDTHS = [THUMB_WIDTH_HERO];

/**
 * One promise per (video, width) pair currently being resolved. Two callers
 * requesting the same size for the same video — a collage cell and that video's
 * own row, say — must share a single `FrameGrabber.grabFrame` call: they'd
 * otherwise both pass the same `outPath` to two real, concurrently-running
 * native writes, and whichever finishes (or fails and deletes the file) last wins
 * over the other. Entries are removed once the shared promise settles, win or
 * lose.
 */
const inFlight = new Map<string, Promise<string | null>>();

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
 * Deletes the other sizes' files for this video that are safe to delete —
 * everything in `OTHER_WIDTHS` except a width whose own `getOrCreateThumbnail`
 * call is currently in flight for this video (see `siblingWidthsToDelete`:
 * deleting a file mid-write would race the native writer's non-atomic
 * `FileOutputStream`). Called only after the card path writes a fresh frame, so
 * a stale-but-not-currently-generating sibling turns back into "absent" and
 * `decideThumbAction` regenerates it on the next request — the only way a
 * version bump or a re-scored card frame reaches non-card sizes, since they
 * never write `thumb_version`/`thumb_uri` themselves.
 */
function deleteSiblingThumbnails(videoId: string): void {
  const inFlightWidths = new Set(
    OTHER_WIDTHS.filter((width) => inFlight.has(`${videoId}@${width}`)),
  );
  for (const width of siblingWidthsToDelete(OTHER_WIDTHS, inFlightWidths)) {
    const file = thumbFile(videoId, width);
    if (file.exists) file.delete();
  }
}

/**
 * Returns a usable thumbnail uri, extracting one if needed.
 *
 * Non-card sizes (the hero banner) reuse the position the card frame won on, so
 * the two never show different moments, and they never write back to the videos
 * row — `thumb_uri` always means the card-sized file.
 */
export function getOrCreateThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
  width: number = THUMB_WIDTH_CARD,
): Promise<string | null> {
  const key = `${video.id}@${width}`;
  const running = inFlight.get(key);
  if (running) return running;

  const promise = limit(() => resolveThumbnail(db, video, width)).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

async function resolveThumbnail(
  db: SQLiteDatabase,
  video: LibraryVideo,
  width: number,
): Promise<string | null> {
  const file = thumbFile(video.id, width);
  const state = await getThumbState(db, video.id);
  const isCard = width === THUMB_WIDTH_CARD;
  const action = decideThumbAction(state, file.exists, isCard);

  if (action === 'serve') return file.uri;
  if (action === 'give-up') return null;

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
      deleteSiblingThumbnails(video.id);
    }
    return result.uri;
  } catch {
    if (isCard) await recordThumbFailure(db, video.id, THUMB_VERSION);
    return null;
  }
}
