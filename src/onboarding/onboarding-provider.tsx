import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';
import { ONBOARDING_VERSION, SETTING_KEYS, resolveOnboardingGate, type OnboardingStatus } from './policy';

export type { OnboardingStatus };

interface Onboarding {
  status: OnboardingStatus;
  complete: () => Promise<void>;
  restart: () => Promise<void>;
}

const OnboardingContext = createContext<Onboarding | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [status, setStatus] = useState<OnboardingStatus>('resolving');

  useEffect(() => {
    let cancelled = false;
    getSetting(db, SETTING_KEYS.onboardingVersion)
      .then((stored) => {
        if (cancelled) return;
        setStatus(resolveOnboardingGate(stored, ONBOARDING_VERSION));
      })
      // A settings read failure must not wedge the app behind a splash screen.
      // Falling through to 'done' shows the library; the tour is replayable
      // from Settings → About.
      .catch(() => {
        if (!cancelled) setStatus('done');
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  const complete = useCallback(async () => {
    await setSetting(db, SETTING_KEYS.onboardingVersion, String(ONBOARDING_VERSION));
    setStatus('done');
  }, [db]);

  /** Settings → About "Show the tour again": re-arms the coach marks too, not
   *  just the carousel, so the whole first-run experience replays. */
  const restart = useCallback(async () => {
    await Promise.all([
      setSetting(db, SETTING_KEYS.onboardingVersion, '0'),
      setSetting(db, SETTING_KEYS.playerCoach, '0'),
      setSetting(db, SETTING_KEYS.homeCoach, '0'),
      setSetting(db, SETTING_KEYS.homeVisits, '0'),
    ]);
    setStatus('needed');
  }, [db]);

  const value = useMemo<Onboarding>(() => ({ status, complete, restart }), [status, complete, restart]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): Onboarding {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within an OnboardingProvider');
  return ctx;
}
