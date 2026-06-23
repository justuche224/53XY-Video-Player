import { useState, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/settings-repo';

export function useBackgroundPlay() {
  const db = useSQLiteContext();
  const [backgroundPlay, setBackgroundPlayState] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;
    getSetting(db, 'background_play').then((val) => {
      if (mounted && val !== null) {
        setBackgroundPlayState(val === 'true');
      }
    });
    return () => {
      mounted = false;
    };
  }, [db]);

  const setBackgroundPlay = async (v: boolean) => {
    setBackgroundPlayState(v);
    await setSetting(db, 'background_play', v ? 'true' : 'false');
  };

  return { backgroundPlay, setBackgroundPlay };
}
