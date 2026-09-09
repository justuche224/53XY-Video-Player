import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getSetting, setSetting } from '@/db/settings-repo';

/**
 * A one-shot coach-mark flag backed by the settings table. `ready` gates
 * rendering: the card must not flash for one frame before the stored value
 * arrives from SQLite.
 */
export function useCoachFlag(key: string) {
  const db = useSQLiteContext();
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSetting(db, key)
      .then((v) => {
        if (cancelled) return;
        setDismissed(v === '1');
        setReady(true);
      })
      // Failing closed means a missed tip, not a stuck overlay.
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, key]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    void setSetting(db, key, '1');
  }, [db, key]);

  return { ready, dismissed, dismiss };
}
