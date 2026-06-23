import { useState, useEffect } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getSetting, setSetting } from '@/db/settings-repo';

export function usePictureInPicture() {
  const db = useSQLiteContext();
  const [pictureInPicture, setPictureInPictureState] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    getSetting(db, 'picture_in_picture').then((val) => {
      if (mounted && val !== null) {
        setPictureInPictureState(val === 'true');
      }
    });
    return () => {
      mounted = false;
    };
  }, [db]);

  const setPictureInPicture = async (v: boolean) => {
    setPictureInPictureState(v);
    await setSetting(db, 'picture_in_picture', v ? 'true' : 'false');
  };

  return { pictureInPicture, setPictureInPicture };
}
