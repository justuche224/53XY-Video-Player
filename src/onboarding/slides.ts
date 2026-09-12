export type SlideKey =
  | 'welcome'
  | 'grouping'
  | 'continuity'
  | 'gestures'
  | 'moments'
  | 'done';

/**
 * `action` is what the slide's primary button does, not what it says. The
 * copy for each action is fixed globally (one label per intent): 'next' →
 * "Next", 'finish' → "Start watching", 'video-access' → "Allow access to your
 * videos", 'all-files' → "Allow" beside a peer "Not now".
 */
export type SlideAction = 'next' | 'video-access' | 'all-files' | 'finish';

export interface OnboardingSlide {
  key: SlideKey;
  headline: string;
  body: string;
  action: SlideAction;
}

/**
 * Order does real work: granting video access on slide 1 means the library
 * scan runs in the background while the user swipes through slides 2–5, so the
 * tour ends on a populated Home instead of a spinner.
 */
export const SLIDES: OnboardingSlide[] = [
  {
    key: 'welcome',
    headline: 'Watch it your way',
    body: 'A fast, local player that stays out of the way — and a library that sorts itself.',
    action: 'video-access',
  },
  {
    key: 'grouping',
    headline: 'Your library, sorted for you',
    body: 'Loose files collapse into series with episode numbers. Prefer the disk? The Folders tab is right there.',
    action: 'next',
  },
  {
    key: 'continuity',
    headline: 'Never lose your place',
    body: 'Every video remembers where you stopped. Pick up from Home, or from your full watch history.',
    action: 'next',
  },
  {
    key: 'gestures',
    headline: 'The player answers to your thumb',
    body: 'Double-tap to skip, swipe for brightness and volume, hold for 2×, pinch to zoom.',
    action: 'next',
  },
  {
    key: 'moments',
    headline: 'Save the scene, not a screenshot',
    body: 'Capture the exact frame — title, timestamp and the subtitle line on screen. Storage access keeps moments safe through a reinstall, and lets 53XY read .srt files.',
    action: 'all-files',
  },
  {
    key: 'done',
    headline: "You're set",
    body: 'Everything else is waiting in the app. Take a look.',
    action: 'finish',
  },
];
