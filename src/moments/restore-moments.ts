import type { Moment } from './types';

/**
 * The manifest entries worth putting back into the database.
 *
 * A moment whose JPEG is missing would restore into a card that can never
 * render its frame, so it is dropped — the manifest is the durable copy, but
 * only as far as the files beside it survived. A moment that never had a
 * frame (the grab failed at capture) keeps its position, title and note, which
 * are the load-bearing parts, so it restores.
 *
 * `frameExists` is injected to keep this decision testable without a
 * filesystem.
 */
export function restorableMoments(
  manifest: Moment[],
  frameExists: (uri: string) => boolean,
): Moment[] {
  return manifest.filter((m) => m.frameUri === null || frameExists(m.frameUri));
}

/** A manifest-only entry is worth keeping only if its JPEG is still there. */
function hasSurvivingFrame(m: Moment, frameExists: (uri: string) => boolean): boolean {
  return m.frameUri !== null && frameExists(m.frameUri);
}

/**
 * Merges the database (the live truth) with whatever is currently on disk in
 * moments.json, for routine manifest writes (capture, migration, note edit).
 *
 * The naive `writeManifest(dir, dbMoments)` these call sites used to do is an
 * unconditional overwrite: right after a reinstall the manifest can hold many
 * moments the (empty) database has never seen, and the first capture would
 * clobber all of them with a 1-entry manifest, permanently orphaning their
 * JPEGs. Merging instead means a manifest-only entry is only ever dropped
 * when it should be — see below — never as a side effect of an unrelated
 * write.
 *
 * Database rows always win over a manifest row with the same id: the
 * database is what the app just wrote, the manifest may be stale.
 *
 * A manifest-only entry (its id absent from the database) is kept only when
 * its frame file still exists. This is what stops a deliberately deleted
 * moment from resurrecting: deleting a moment deletes its row AND its JPEG,
 * so a stale manifest entry left over from before that delete fails the
 * frame check and is dropped rather than merged back in. A moment that is
 * genuinely awaiting restore (e.g. post-reinstall, before its row exists)
 * still has its JPEG on disk, so it survives the check and is kept.
 *
 * Asymmetric with `restorableMoments` on purpose: `restorableMoments` keeps a
 * frameless manifest-only entry (frameUri === null) because there it is
 * restoring a manifest already known to be good — the frame legitimately
 * never existed (the grab failed at capture). Here, a frameless entry with no
 * database row is indistinguishable from a deleted moment whose frame is
 * simply gone, so it is dropped rather than risk resurrecting a delete.
 */
export function mergeManifest(
  dbMoments: Moment[],
  manifestMoments: Moment[],
  frameExists: (uri: string) => boolean,
): Moment[] {
  const dbIds = new Set(dbMoments.map((m) => m.id));
  const manifestOnly = manifestMoments.filter(
    (m) => !dbIds.has(m.id) && hasSurvivingFrame(m, frameExists),
  );
  return [...dbMoments, ...manifestOnly];
}

/**
 * The manifest entries the database is missing — what a restore should
 * insert. Same frame-existence and frameless-drop rules as `mergeManifest`,
 * for the same reason: a manifest entry only earns a spot back in the
 * database when it is neither already there nor a stale trace of a delete.
 */
export function missingFromDb(
  manifestMoments: Moment[],
  dbMoments: Moment[],
  frameExists: (uri: string) => boolean,
): Moment[] {
  const dbIds = new Set(dbMoments.map((m) => m.id));
  return manifestMoments.filter((m) => !dbIds.has(m.id) && hasSurvivingFrame(m, frameExists));
}

const KB = 1024;
const MB = KB * 1024;

/** Human-readable size for the Settings row. Never renders NaN or a negative. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}
