import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { getMoments, insertMoment, updateMomentNote } from '@/db/moments-repo';
import { FrameGrabber } from '@/native/frame-grabber';
import { captureMoment, type CaptureInput } from './capture';
import { ensureMomentsDir, writeManifest } from './storage';
import type { Moment } from './types';

function newMomentId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Captures the current frame and persists it. Throws only if the DB write fails. */
export function useCaptureMoment(): (input: CaptureInput) => Promise<Moment> {
  const db = useSQLiteContext();

  return useCallback(
    (input: CaptureInput) => {
      const dir = ensureMomentsDir();
      return captureMoment(input, {
        grabFrame: (uri, options) => FrameGrabber.grabFrame(uri, options),
        insert: (moment) => insertMoment(db, moment),
        syncManifest: async () => writeManifest(dir, await getMoments(db)),
        momentsDir: dir,
        now: Date.now,
        newId: newMomentId,
      });
    },
    [db],
  );
}

/** Saves an edited note and keeps the manifest in step. */
export function useUpdateMomentNote(): (id: string, note: string) => Promise<void> {
  const db = useSQLiteContext();

  return useCallback(
    async (id: string, note: string) => {
      await updateMomentNote(db, id, note.trim() || null);
      try {
        writeManifest(ensureMomentsDir(), await getMoments(db));
      } catch {
        // Same reasoning as capture: the row is saved; the mirror can lag.
      }
    },
    [db],
  );
}
