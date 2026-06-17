export function computeProgressPercent(
  positionMs: number,
  durationMs: number | null | undefined,
): number {
  if (!durationMs || durationMs <= 0) return 0;
  const pct = positionMs / durationMs;
  if (pct < 0) return 0;
  if (pct > 1) return 1;
  return pct;
}

export function isCompleted(percent: number, threshold = 0.95): boolean {
  return percent >= threshold;
}
