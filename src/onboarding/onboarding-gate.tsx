import { usePathname, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useOnboarding } from './onboarding-provider';

/**
 * Redirects into the tour when it is due. Renders nothing.
 *
 * `replace`, never `push`: this is a one-way door in both directions. Back
 * from inside the tour must not reach a library the user has not granted
 * access to, and back from the library must not walk into a half-finished
 * tour.
 *
 * This is also the ONLY place that calls `replace('/onboarding')` — Settings
 * → About's "Show the tour again" only flips `status` to `'needed'` and does
 * not navigate itself. Two independent call sites racing the same transition
 * is exactly what produced I3: `restart()` flips `status`, `about.tsx` used
 * to synchronously `replace()` too, and if that commit landed before
 * `pathname` caught up, this effect's own condition was still true on the
 * next run and fired a second `replace`, remounting the screen (double fade,
 * slide index reset). Funneling the navigation through this single effect
 * makes a duplicate structurally impossible: it already re-runs on every
 * `status`/`pathname` change and already no-ops once `pathname` catches up.
 */
export function OnboardingGate() {
  const { status } = useOnboarding();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status !== 'needed') return;
    if (pathname === '/onboarding') return;
    router.replace('/onboarding');
  }, [status, pathname, router]);

  return null;
}
