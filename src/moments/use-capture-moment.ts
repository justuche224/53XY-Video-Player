import { Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import { getMoments, insertMoment, updateMomentFrameUri, updateMomentNote } from '@/db/moments-repo';
import { FrameGrabber } from '@/native/frame-grabber';
import { captureMoment, type CaptureInput } from './capture';
import { planMomentMigration } from './migrate-moments';
import { normalizeDirUri, pickMomentsDir } from './moments-dir';
import { deleteManifest, ensureMomentsDir, moveMomentFrames, writeManifest } from './storage';
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
 * Each row is updated right after its own file moves, inside
 * `moveMomentFrames`'s loop, rather than in a second pass afterwards — a
 * process killed mid-migration (very plausible: the user has just come back
 * from the system Settings app, and a backgrounded RN process is a prime kill
 * target) can then orphan at most the one frame it was working on, not the
 * whole batch. `moveMomentFrames` itself heals a row left orphaned by an
 * earlier interrupted run, so a second attempt catches up.
 */
export function useMigrateMoments(): () => Promise<void> {
  const db = useSQLiteContext();

  return useCallback(async () => {
    try {
      const moments = await getMoments(db);
      const dir = ensureMomentsDir();
      const plan = planMomentMigration(moments, dir);
      if (plan.length === 0) return;

      await moveMomentFrames(plan, (move) => updateMomentFrameUri(db, move.id, move.toUri));
      writeManifest(dir, await getMoments(db));

      // The migration only ever moves frames OUT of the fallback directory,
      // so once it succeeds that directory's manifest is stale — leaving it
      // behind means two contradictory moments.json files on disk.
      const fallbackDir = pickMomentsDir(false, Paths.document.uri);
      if (normalizeDirUri(fallbackDir) !== normalizeDirUri(dir)) {
        deleteManifest(fallbackDir);
      }
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
