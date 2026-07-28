// src/player/sleep-timer.ts
// Pure sleep-timer math. Times are ms epochs so the player can tick with
// Date.now() without this module holding any state.

export const SLEEP_PRESETS_MIN = [15, 30, 60] as const;
export const FADE_WINDOW_SEC = 10;
export const CUSTOM_MIN_MINUTES = 5;
export const CUSTOM_MAX_MINUTES = 180;
export const CUSTOM_STEP_MINUTES = 5;

export type SleepTimer =
  | { kind: 'minutes'; endAtMs: number }
  | { kind: 'endOfVideo' };

export function minutesTimer(minutes: number, nowMs: number): SleepTimer {
  return { kind: 'minutes', endAtMs: nowMs + minutes * 60_000 };
}

/** Whole seconds left, never negative. */
export function remainingSec(endAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
}

/** Minutes shown on the moon-icon badge: ceil so "1" means "under a minute left". */
export function badgeMinutes(remaining: number): number {
  return Math.max(1, Math.ceil(remaining / 60));
}

/**
 * Volume for the fade-out: full until the last FADE_WINDOW_SEC, then a
 * linear ramp to 0 at expiry.
 */
export function fadeVolume(remaining: number): number {
  if (remaining >= FADE_WINDOW_SEC) return 1;
  if (remaining <= 0) return 0;
  return remaining / FADE_WINDOW_SEC;
}

export function clampCustomMinutes(minutes: number): number {
  if (minutes < CUSTOM_MIN_MINUTES) return CUSTOM_MIN_MINUTES;
  if (minutes > CUSTOM_MAX_MINUTES) return CUSTOM_MAX_MINUTES;
  return minutes;
}
