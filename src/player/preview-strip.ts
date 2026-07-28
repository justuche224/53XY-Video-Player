// src/player/preview-strip.ts
// Pure slot math for scrub-preview strips. A video is divided into equal
// slots; one frame is captured at each slot's midpoint. All lookups are
// slot-index based so a partially generated strip is usable immediately.

export const PREVIEW_TARGET_FRAMES = 50;
export const PREVIEW_MIN_INTERVAL_SEC = 5;
export const PREVIEW_MAX_INTERVAL_SEC = 60;
/** How many slots away a cached frame may be and still represent the target.
 *  Beyond this the bubble shows timestamp-only rather than a misleading frame. */
export const PREVIEW_MAX_SLOT_DISTANCE = 1;

export function previewIntervalSec(durationSec: number): number {
  const raw = durationSec / PREVIEW_TARGET_FRAMES;
  if (raw < PREVIEW_MIN_INTERVAL_SEC) return PREVIEW_MIN_INTERVAL_SEC;
  if (raw > PREVIEW_MAX_INTERVAL_SEC) return PREVIEW_MAX_INTERVAL_SEC;
  return raw;
}

export function frameCount(durationSec: number, intervalSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.max(1, Math.floor(durationSec / intervalSec));
}

/** Capture time for a slot: its midpoint, clamped into the video. */
export function frameTimeMs(idx: number, intervalSec: number, durationSec: number): number {
  const t = (idx + 0.5) * intervalSec;
  return Math.round(Math.min(t, Math.max(0, durationSec - 0.5)) * 1000);
}

/** Slot index whose midpoint best represents a target position. */
export function frameIndexFor(targetSec: number, intervalSec: number, count: number): number {
  if (count <= 0 || intervalSec <= 0) return 0;
  const idx = Math.floor(targetSec / intervalSec);
  return Math.min(Math.max(0, idx), count - 1);
}

/**
 * Nearest completed slot to `idx` within PREVIEW_MAX_SLOT_DISTANCE, preferring
 * the exact slot, then closer neighbors (earlier side wins ties).
 */
export function nearestCompleted(
  idx: number,
  completed: ReadonlySet<number>,
  count: number,
): number | null {
  for (let d = 0; d <= PREVIEW_MAX_SLOT_DISTANCE; d++) {
    const before = idx - d;
    if (before >= 0 && completed.has(before)) return before;
    const after = idx + d;
    if (d > 0 && after < count && completed.has(after)) return after;
  }
  return null;
}
