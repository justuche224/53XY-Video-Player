import type { LibraryVideo } from '@/library/types';
import { RELINK_DURATION_TOLERANCE_MS } from './moment-policy';
import type { Moment } from './types';

export type MomentTarget =
  | { kind: 'exact'; video: LibraryVideo }
  | { kind: 'relinked'; video: LibraryVideo }
  | { kind: 'missing' };

/**
 * How far apart two durations may be and still be considered the same file.
 * `null` on either side means there is nothing to compare, so the filename
 * match stands on its own — the best evidence available.
 */
function durationsAgree(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return true;
  return Math.abs(a - b) <= RELINK_DURATION_TOLERANCE_MS;
}

/**
 * Find the video a moment should play.
 *
 * The stored `videoId` is a MediaStore id, which does not survive the file
 * being moved and rescanned — so a failed id lookup falls back to matching on
 * filename AND duration together. Filename alone would happily relink to a
 * different cut of the same episode sitting in another folder; duration is the
 * cheap second signal that rules that out. Recovering a *renamed* file would
 * need content hashing, which is not worth reading whole files for.
 */
export function resolveMomentTarget(moment: Moment, videos: LibraryVideo[]): MomentTarget {
  if (moment.videoId !== null) {
    const exact = videos.find((v) => v.id === moment.videoId);
    if (exact) return { kind: 'exact', video: exact };
  }

  const candidates = videos.filter(
    (v) => v.filename === moment.filename && durationsAgree(v.durationMs, moment.durationMs),
  );
  if (candidates.length === 0) return { kind: 'missing' };

  // Several files can share a basename across folders; the closest duration is
  // the likeliest to be the same file. An unknown duration sorts last.
  const best = candidates.reduce((a, b) => {
    const da = a.durationMs === null || moment.durationMs === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(a.durationMs - moment.durationMs);
    const db = b.durationMs === null || moment.durationMs === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(b.durationMs - moment.durationMs);
    return db < da ? b : a;
  });

  return { kind: 'relinked', video: best };
}
