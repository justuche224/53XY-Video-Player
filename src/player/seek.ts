export function seekTarget(currentSec: number, deltaSec: number, durationSec: number): number {
  const target = currentSec + deltaSec;
  const lower = Math.max(0, target);
  if (durationSec <= 0) return lower;
  return Math.min(durationSec, lower);
}

export function tapSide(x: number, width: number): 'left' | 'right' {
  return x < width / 2 ? 'left' : 'right';
}
