import { computeProgressPercent, isCompleted } from '@/db/progress';

export interface ProgressWrite {
  positionMs: number;
  percent: number;
  completed: boolean;
  lastPlayedAt: number;
}

const WRITE_INTERVAL_MS = 5_000;

export function buildProgress(
  positionMs: number,
  durationMs: number | null,
  nowMs: number,
): ProgressWrite {
  const percent = computeProgressPercent(positionMs, durationMs);
  return { positionMs, percent, completed: isCompleted(percent), lastPlayedAt: nowMs };
}

export function shouldWrite(lastWriteMs: number, nowMs: number, intervalMs = WRITE_INTERVAL_MS): boolean {
  return nowMs - lastWriteMs >= intervalMs;
}
