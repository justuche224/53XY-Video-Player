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

export type LengthUnit = 'sec' | 'min' | 'hr';

const UNIT_MS: Record<LengthUnit, number> = { sec: 1_000, min: 60_000, hr: 3_600_000 };
const UNIT_SUFFIX: Record<LengthUnit, string> = { sec: 's', min: 'm', hr: 'h' };

export function partsToMs(value: number, unit: LengthUnit): number {
  return Math.round(value * UNIT_MS[unit]);
}

export function msToParts(ms: number): { value: number; unit: LengthUnit } {
  if (ms % UNIT_MS.hr === 0) return { value: ms / UNIT_MS.hr, unit: 'hr' };
  if (ms % UNIT_MS.min === 0) return { value: ms / UNIT_MS.min, unit: 'min' };
  return { value: Math.round(ms / UNIT_MS.sec), unit: 'sec' };
}

export function formatLengthShort(ms: number): string {
  const { value, unit } = msToParts(ms);
  return `${value}${UNIT_SUFFIX[unit]}`;
}
