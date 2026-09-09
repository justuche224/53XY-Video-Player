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
