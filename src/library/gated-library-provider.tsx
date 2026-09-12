import { useEffect, useRef, type ReactNode } from 'react';

import { useOnboarding } from '@/onboarding/onboarding-provider';
import { shouldAutoRequestAfterTour } from '@/onboarding/policy';
import { LibraryProvider } from './library-provider';

/**
 * LibraryProvider must not fire the media permission dialog while the tour
 * is pending — the tour owns the timing of that dialog.
 *
 * `tourShownRef` also stops LibraryProvider from firing its OWN automatic ask
 * once the tour finishes or is skipped. Without it: a user who declines the
 * tour's explicit "Allow access" once (still `'askable'`, not yet permanently
 * blocked) or taps Skip on slide 1 (never asked at all) would see `status`
 * flip to `'done'` at the same beat as the Home transition, `autoRequest`
 * flip true, and LibraryProvider's own scan effect fire a second, unrequested
 * system dialog right over the slide-6 → Home animation. The ref is set the
 * moment `status` is first observed as `'needed'`, so it stays true for the
 * rest of the run — an install that never needed the tour (already
 * onboarded) never sets it and keeps the original automatic ask.
 */
export function GatedLibraryProvider({ children }: { children: ReactNode }) {
  const { status } = useOnboarding();
  const tourShownRef = useRef(false);
  useEffect(() => {
    if (status === 'needed') tourShownRef.current = true;
  }, [status]);
  return (
    <LibraryProvider autoRequest={shouldAutoRequestAfterTour(status, tourShownRef.current)}>
      {children}
    </LibraryProvider>
  );
}
