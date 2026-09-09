import { usePermissions } from 'expo-media-library';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { invalidateMomentsDir } from '@/moments/storage';
import { canReadFolder } from '@/subtitles/storage-access';
import { resolveVideoAccess, type VideoAccess } from './video-access';

/** The always-present volume root all-files access is probed against. */
const EXTERNAL_STORAGE_ROOT = 'file:///storage/emulated/0';

interface MediaAccess {
  videoAccess: VideoAccess;
  requestVideoAccess: () => Promise<void>;
  allFilesAccess: boolean;
  recheckAllFilesAccess: () => void;
}

const MediaAccessContext = createContext<MediaAccess | null>(null);

/**
 * The single owner of media permission state, mounted above LibraryProvider.
 *
 * LibraryProvider used to hold `usePermissions` itself and fire the request on
 * mount. That had to move: the onboarding tour needs to control *when* the
 * system dialog appears (after the slide that explains why), and two separate
 * `usePermissions` instances hold independent state — granting through one
 * would not reliably wake the other, leaving the library unscanned.
 */
export function MediaAccessProvider({ children }: { children: ReactNode }) {
  const [permission, requestPermission] = usePermissions({ granularPermissions: ['video'] });
  const [allFilesAccess, setAllFilesAccess] = useState(() => canReadFolder(EXTERNAL_STORAGE_ROOT));

  const requestVideoAccess = useCallback(async () => {
    await requestPermission();
  }, [requestPermission]);

  /**
   * Re-probe after the user comes back from the system settings trip.
   *
   * `invalidateMomentsDir()` is not optional. `ensureMomentsDir()` caches its
   * answer for the life of the process, so a grant made mid-session would read
   * as granted while every captured frame kept landing in the app-document
   * fallback until the next app start — silent, and painful to trace.
   */
  const recheckAllFilesAccess = useCallback(() => {
    invalidateMomentsDir();
    setAllFilesAccess(canReadFolder(EXTERNAL_STORAGE_ROOT));
  }, []);

  const value = useMemo<MediaAccess>(
    () => ({
      videoAccess: resolveVideoAccess(permission),
      requestVideoAccess,
      allFilesAccess,
      recheckAllFilesAccess,
    }),
    [permission, requestVideoAccess, allFilesAccess, recheckAllFilesAccess],
  );

  return <MediaAccessContext.Provider value={value}>{children}</MediaAccessContext.Provider>;
}

export function useMediaAccess(): MediaAccess {
  const ctx = useContext(MediaAccessContext);
  if (!ctx) throw new Error('useMediaAccess must be used within a MediaAccessProvider');
  return ctx;
}
