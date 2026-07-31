/**
 * Layout math that has to be right on every screen size, kept pure so it can be
 * tested without a device.
 */

/** Hero banner: share of the window it occupies below the status bar. */
const HERO_FRACTION = 0.42;
/** Small phones: never let the banner shrink past the point where the title,
 *  progress line and buttons stop fitting under the pinned header. */
const HERO_MIN = 280;
/** Tablets / very tall phones: past this the banner stops feeling like a header
 *  and starts feeling like a page. */
const HERO_MAX = 380;

/**
 * Total height of the full-bleed hero, including the status-bar area it draws
 * under. `insetTop` is added on top of the content band rather than eaten out of
 * it, so the visible artwork is the same size regardless of notch depth.
 */
export function heroHeight(windowHeight: number, insetTop: number): number {
  const band = Math.min(HERO_MAX, Math.max(HERO_MIN, windowHeight * HERO_FRACTION));
  return Math.round(band + Math.max(0, insetTop));
}

/**
 * Scroll offset at which the pinned header swaps from "over artwork" to "over
 * page". Fires slightly before the artwork fully clears the header so the solid
 * background is already there by the time content would collide with it.
 */
export function headerSolidThreshold(heroTotalHeight: number, headerHeight: number): number {
  return Math.max(0, heroTotalHeight - headerHeight - 24);
}
