import { useState, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/settings-repo';

/** Autoplay-next setting — ON by default per spec; only a stored 'false' disables it. */
export function useAutoplayNext() {
  const db = useSQLiteContext();
  const [autoplayNext, setAutoplayNextState] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    getSetting(db, 'autoplay_next').then((val) => {
      if (mounted && val !== null) {
        setAutoplayNextState(val === 'true');
      }
    });
    return () => {
      mounted = false;
    };
  }, [db]);

  const setAutoplayNext = async (v: boolean) => {
    setAutoplayNextState(v);
    await setSetting(db, 'autoplay_next', v ? 'true' : 'false');
  };

  return { autoplayNext, setAutoplayNext };
}
