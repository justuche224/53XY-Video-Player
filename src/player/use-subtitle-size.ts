import { useState, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import { getSetting, setSetting } from '@/db/settings-repo';
import type { SubtitleSize } from '@/components/player/subtitle-overlay';

const VALID: SubtitleSize[] = ['s', 'm', 'l', 'xl'];

/** Global subtitle text size. Defaults to medium. */
export function useSubtitleSize() {
  const db = useSQLiteContext();
  const [subtitleSize, setSubtitleSizeState] = useState<SubtitleSize>('m');

  useEffect(() => {
    let mounted = true;
    getSetting(db, 'subtitle_text_size').then((val) => {
      if (mounted && val !== null && VALID.includes(val as SubtitleSize)) {
        setSubtitleSizeState(val as SubtitleSize);
      }
    });
    return () => {
      mounted = false;
    };
  }, [db]);

  const setSubtitleSize = async (v: SubtitleSize) => {
    setSubtitleSizeState(v);
    await setSetting(db, 'subtitle_text_size', v);
  };

  return { subtitleSize, setSubtitleSize };
}
