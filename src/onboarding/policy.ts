/**
 * First-run tour policy. Version-gated rather than keyed on "has the library
 * ever been scanned" so the tour shows once for every install including
 * existing ones, can be re-triggered by bumping the constant when a major
 * feature lands, and can be tested without clearing app data.
 */
export const ONBOARDING_VERSION = 1;

export type OnboardingStatus = 'resolving' | 'needed' | 'done';

/** Keys in the existing `settings` key/value table. No migration needed. */
export const SETTING_KEYS = {
  onboardingVersion: 'onboarding_version',
  playerCoach: 'coach_player_gestures',
  homeCoach: 'coach_home_longpress',
  homeVisits: 'home_visit_count',
} as const;

/**
 * A stored value we cannot parse means we have no evidence the user ever saw
 * the tour, so we show it. A stored version *ahead* of ours is a downgraded
 * build — showing an older tour to someone who has seen a newer one is noise,
 * so that counts as done.
 */
export function resolveOnboardingGate(
  stored: string | null,
  current: number,
): 'needed' | 'done' {
  if (stored === null) return 'needed';
  const parsed = Number.parseInt(stored, 10);
  if (!Number.isFinite(parsed)) return 'needed';
  return parsed >= current ? 'done' : 'needed';
}

export function nextSlideIndex(current: number, total: number): number {
  return Math.min(current + 1, total - 1);
}

/**
 * Back on the first slide is a no-op, not an app exit — an accidental back
 * press should not close the app the user just installed.
 */
export function prevSlideIndex(current: number): number {
  return Math.max(0, current - 1);
}

export function isLastSlide(current: number, total: number): boolean {
  return current === total - 1;
}

/**
 * Whether LibraryProvider's own automatic video-permission ask is allowed to
 * fire.
 *
 * The tour's video-access slide already owns the explicit ask while it is
 * showing, and tapping Skip is a deliberate decline of it. Either way, once
 * the tour has been shown this run (`status` passed through `'needed'`), the
 * automatic ask must never fire again when `status` reaches `'done'` — that
 * transition would otherwise ambush the user with a system permission dialog
 * exactly as they land on Home. `'resolving'` never counts as having shown
 * the tour: it settles to one of the other two almost immediately on every
 * app start, tour or not.
 *
 * An install that never needed the tour this run (already onboarded — an
 * existing user, or one restoring settings) never has `tourWasShown` go
 * true, so it keeps the original automatic ask unchanged.
 */
export function shouldAutoRequestAfterTour(status: OnboardingStatus, tourWasShown: boolean): boolean {
  return status === 'done' && !tourWasShown;
}
