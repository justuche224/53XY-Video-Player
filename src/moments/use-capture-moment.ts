import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { getMoments, insertMoment, updateMomentFrameUri, updateMomentNote } from '@/db/moments-repo';
import { FrameGrabber } from '@/native/frame-grabber';
import { captureMoment, type CaptureInput } from './capture';
import { planMomentMigration } from './migrate-moments';
import { ensureMomentsDir, moveMomentFrames, writeManifest } from './storage';
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

/**
 * Moves any moments still sitting in the fallback directory into shared
 * storage (once `momentsDirIsShared()` turns true) and updates the DB to
 * match. Called from the player screen's focus effect after re-probing.
 *
 * Only rows whose file actually moved get their `frame_uri` rewritten —
 * `moveMomentFrames` is best-effort per file, and a frame left behind must
 * keep the uri that still resolves rather than being pointed at a path that
 * holds no file.
 */
export function useMigrateMoments(): () => Promise<void> {
  const db = useSQLiteContext();

  return useCallback(async () => {
    try {
      const moments = await getMoments(db);
      const dir = ensureMomentsDir();
      const plan = planMomentMigration(moments, dir);
      if (plan.length === 0) return;

      const moved = moveMomentFrames(plan);
      for (const move of moved) {
        await updateMomentFrameUri(db, move.id, move.toUri);
      }
      writeManifest(dir, await getMoments(db));
    } catch (error) {
      console.warn('[moments] migration to shared storage failed:', error);
    }
  }, [db]);
}

/** Saves an edited note and keeps the manifest in step. */
export function useUpdateMomentNote(): (id: string, note: string) => Promise<void> {
  const db = useSQLiteContext();

  return useCallback(
    async (id: string, note: string) => {
      await updateMomentNote(db, id, note.trim() || null);
      try {
        writeManifest(ensureMomentsDir(), await getMoments(db));
      } catch (error) {
        // Same reasoning as capture: the row is saved; the mirror can lag.
        console.warn('[moments] manifest sync failed after note edit, moments.json may be stale:', error);
      }
    },
    [db],
  );
}
