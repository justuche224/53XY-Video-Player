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

const KB = 1024;
const MB = KB * 1024;

/** Human-readable size for the Settings row. Never renders NaN or a negative. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}
