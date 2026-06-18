export function seekTarget(currentSec: number, deltaSec: number, durationSec: number): number {
  const target = currentSec + deltaSec;
  const lower = Math.max(0, target);
  if (durationSec <= 0) return lower;
  return Math.min(durationSec, lower);
}

export type TapZone = 'left' | 'center' | 'right';

/** Splits the width into equal thirds: left | center | right. */
export function tapZone(x: number, width: number): TapZone {
  if (x < width / 3) return 'left';
  if (x >= (2 * width) / 3) return 'right';
  return 'center';
}
