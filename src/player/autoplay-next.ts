// src/player/autoplay-next.ts
// Pure decision logic for the end-of-video autoplay countdown.

export const AUTOPLAY_COUNTDOWN_SEC = 5;

/**
 * Spec: countdown only when a next neighbor exists, the setting is on, and
 * no end-of-video sleep timer is armed (sleep wins). Everything else keeps
 * today's replay behavior.
 */
export function shouldAutoplayNext(
  hasNext: boolean,
  enabled: boolean,
  sleepAtEndArmed: boolean,
): boolean {
  return hasNext && enabled && !sleepAtEndArmed;
}
