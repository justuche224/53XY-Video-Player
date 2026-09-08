import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';

import { deleteMoments, getMoments, replaceAllMoments } from '@/db/moments-repo';
import { restorableMoments } from './restore-moments';
import { deleteFrame, ensureMomentsDir, readManifest, writeManifest } from './storage';

function frameExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * How many moments the manifest on disk could put back.
 *
 * Zero once the table has any rows: the manifest is a recovery copy, and
 * offering to "restore" over live data would be a way to lose the newer of the
 * two. This is what the Moments tab's empty state asks before offering.
 */
export async function pendingRestoreCount(db: SQLiteDatabase): Promise<number> {
  try {
    const existing = await getMoments(db);
    if (existing.length > 0) return 0;
    return restorableMoments(readManifest(ensureMomentsDir()), frameExists).length;
  } catch (e) {
    console.warn('[moments] could not check for a restorable manifest:', e);
    return 0;
  }
}

/** Puts the manifest's usable moments back. Returns how many were restored. */
export async function restoreMomentsFromManifest(db: SQLiteDatabase): Promise<number> {
  // The manifest is a recovery copy of unknown age. If the table already has
  // rows, restoring over them would run replaceAllMoments' DELETE FROM moments
  // and destroy whichever of the two — live data or manifest — is newer. Bail
  // out before even reading the manifest. This holds even if a caller skips
  // the pendingRestoreCount() check the UI is expected to make first.
  const existing = await getMoments(db);
  if (existing.length > 0) return 0;

  const recovered = restorableMoments(readManifest(ensureMomentsDir()), frameExists);
  if (recovered.length === 0) return 0;
  await replaceAllMoments(db, recovered);
  // Rewrite from what actually landed, so the manifest stops advertising
  // entries whose frames were missing.
  try {
    writeManifest(ensureMomentsDir(), recovered);
  } catch (e) {
    console.warn('[moments] restored but could not rewrite the manifest:', e);
  }
  return recovered.length;
}

/**
 * Delete every moment: rows first, then frames, then the manifest — the same
 * order the per-moment deletes use, so a failure leaves leaked files rather
 * than rows pointing at deleted ones.
 */
export async function clearAllMoments(db: SQLiteDatabase): Promise<void> {
  const all = await getMoments(db);
  await deleteMoments(db, all.map((m) => m.id));
  for (const moment of all) deleteFrame(moment.frameUri);
  try {
    writeManifest(ensureMomentsDir(), []);
  } catch (e) {
    console.warn('[moments] cleared moments but could not rewrite the manifest:', e);
  }
}
