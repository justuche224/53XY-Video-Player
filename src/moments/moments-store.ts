import type { SQLiteDatabase } from 'expo-sqlite';
import { File } from 'expo-file-system';

import { deleteMoments, getMoments, insertMoment } from '@/db/moments-repo';
import { missingFromDb } from './restore-moments';
import { deleteFrame, ensureMomentsDir, readManifest, writeManifest } from './storage';

function frameExists(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/**
 * How many manifest entries the database is missing.
 *
 * Not gated on the table being empty: restore now merges — it only inserts
 * what is missing — so it is safe (and exactly what a user who captured once
 * before ever restoring needs) to offer a restore alongside existing rows.
 */
export async function pendingRestoreCount(db: SQLiteDatabase): Promise<number> {
  try {
    const existing = await getMoments(db);
    return missingFromDb(readManifest(ensureMomentsDir()), existing, frameExists).length;
  } catch (e) {
    console.warn('[moments] could not check for a restorable manifest:', e);
    return 0;
  }
}

/**
 * Inserts whatever manifest entries the database is missing. Returns how many
 * were restored.
 *
 * Deliberately additive, not a replace: a table that already has rows (e.g.
 * because the user captured a moment before ever visiting the Moments tab
 * after a reinstall) must not be wiped and rebuilt from the manifest — that
 * would destroy the very row `pendingRestoreCount` is now happy to restore
 * alongside.
 */
export async function restoreMomentsFromManifest(db: SQLiteDatabase): Promise<number> {
  const existing = await getMoments(db);
  const missing = missingFromDb(readManifest(ensureMomentsDir()), existing, frameExists);
  if (missing.length === 0) return 0;

  for (const moment of missing) {
    await insertMoment(db, moment);
  }

  // Rewrite from the resulting database state, so the manifest stops
  // advertising entries whose frames were missing.
  try {
    writeManifest(ensureMomentsDir(), await getMoments(db));
  } catch (e) {
    console.warn('[moments] restored but could not rewrite the manifest:', e);
  }
  return missing.length;
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
