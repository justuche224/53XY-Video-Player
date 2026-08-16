import type { Cue } from './types';

/** How far back to walk looking for a long cue that is still on screen. */
const MAX_LOOKBACK = 32;

/**
 * Cues active at `timeMs`, given a delay offset. `cues` must be sorted by
 * startMs (every parser guarantees this).
 *
 * Delay convention: positive delay means subtitles appear LATER, so the
 * lookup happens at `timeMs - delayMs`.
 *
 * ASS files routinely overlap a sign with a line of dialogue, so this returns
 * an array rather than a single cue, capped at `max`.
 */
export function activeCues(cues: Cue[], timeMs: number, delayMs: number, max = 3): Cue[] {
  if (cues.length === 0) return [];
  const t = timeMs - delayMs;

  // Binary search for the first cue starting after t.
  let lo = 0;
  let hi = cues.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].startMs <= t) lo = mid + 1;
    else hi = mid;
  }

  // Walk back from there: an earlier long cue can still be on screen, so we
  // cannot stop at the first non-match. Bounded, since overlaps are shallow.
  const out: Cue[] = [];
  for (let i = lo - 1; i >= 0 && lo - 1 - i < MAX_LOOKBACK; i -= 1) {
    const cue = cues[i];
    if (cue.endMs > t) {
      out.unshift(cue);
      if (out.length >= max) break;
    }
  }
  return out;
}

export function cueTextOf(cues: Cue[]): string {
  return cues.map((c) => c.text).join('\n');
}
