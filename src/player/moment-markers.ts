/**
 * Where to draw a tick for each saved moment, as a 0-1 fraction of the bar.
 *
 * Positions outside the video are dropped rather than clamped: a moment can
 * outlive an exact file and be relinked to a slightly different cut, and a tick
 * pinned to the very end would claim a scene is there when it is not.
 */
export function markerFractions(positionsMs: number[], durationMs: number): number[] {
  if (durationMs <= 0) return [];
  const out: number[] = [];
  for (const ms of positionsMs) {
    if (ms < 0 || ms > durationMs) continue;
    out.push(ms / durationMs);
  }
  return out;
}
