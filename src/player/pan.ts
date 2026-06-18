export function panAxis(dx: number, dy: number): 'horizontal' | 'vertical' {
  return Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
}

export function panHalf(x: number, width: number): 'left' | 'right' {
  return x < width / 2 ? 'left' : 'right';
}

export function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

export function scrubDeltaSec(dx: number, width: number, windowSec: number): number {
  if (width <= 0) return 0;
  return (dx / width) * windowSec;
}
