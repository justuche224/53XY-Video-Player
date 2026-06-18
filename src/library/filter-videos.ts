import type { LibraryVideo } from './types';

export interface LengthFilter {
  /** Hide videos strictly shorter than this many ms. null = no minimum. */
  minDurationMs: number | null;
  /** Hide videos strictly longer than this many ms. null = no maximum. */
  maxDurationMs: number | null;
}

export const EMPTY_FILTER: LengthFilter = { minDurationMs: null, maxDurationMs: null };

/**
 * Keep videos whose duration is within [min, max]. Videos with unknown
 * (null) duration are always kept — we don't hide what we can't measure.
 * Comparison is strict, so a video exactly at a threshold stays visible.
 * An empty filter is a pass-through (returns the same array reference).
 */
export function applyLengthFilter(videos: LibraryVideo[], filter: LengthFilter): LibraryVideo[] {
  const { minDurationMs, maxDurationMs } = filter;
  if (minDurationMs == null && maxDurationMs == null) return videos;
  return videos.filter((video) => {
    const d = video.durationMs;
    if (d == null) return true;
    if (minDurationMs != null && d < minDurationMs) return false;
    if (maxDurationMs != null && d > maxDurationMs) return false;
    return true;
  });
}
