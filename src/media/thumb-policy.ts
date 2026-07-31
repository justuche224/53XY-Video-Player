import type { ThumbState } from '@/db/thumbs-repo';

/**
 * Bump when the extraction algorithm changes. Every thumbnail stamped with a
 * lower version is treated as stale and regenerated — no migration required.
 */
export const THUMB_VERSION = 2;

/** Library cards, rows and collages. ~45 KB per video at this quality. */
export const THUMB_WIDTH_CARD = 640;
/** Continue-watching banner — full-bleed, so it shows every soft pixel. */
export const THUMB_WIDTH_HERO = 1280;

export const THUMB_QUALITY_CARD = 0.8;
export const THUMB_QUALITY_HERO = 0.85;

/**
 * Luma standard deviation a frame must reach to be accepted without trying the
 * next candidate. Real scenes land around 0.15–0.30; flat frames sit under 0.05.
 */
export const THUMB_MIN_SCORE = 0.12;

/** Consecutive failures before a video is left alone (corrupt/unsupported file). */
export const THUMB_MAX_ATTEMPTS = 3;

/**
 * Fractions of duration to try, in order. 25% is reliably mid-scene, past
 * cold-opens and title sequences; the rest are escape hatches for long intros,
 * long files, and dark middle acts.
 */
const CANDIDATE_FRACTIONS = [0.25, 0.45, 0.12, 0.65];

/** Used when the scan gave us no duration — better than nothing, worse than a fraction. */
const FALLBACK_POSITION_MS = 3000;

/** Never grab from the first or last second: fades and end cards live there. */
const EDGE_GUARD_MS = 1000;

/** Candidates closer than this land on the same keyframe, so the extra decode is waste. */
const DEDUPE_MS = 1000;

/**
 * The ladder of positions to try, in priority order. The native grabber walks it
 * and stops at the first frame scoring >= THUMB_MIN_SCORE.
 */
export function candidatePositions(durationMs: number | null): number[] {
  if (!durationMs || durationMs <= 0) return [FALLBACK_POSITION_MS];

  const latest = durationMs - EDGE_GUARD_MS;
  // Too short for the guard band to make sense — one frame from the middle.
  if (latest <= EDGE_GUARD_MS) return [Math.floor(durationMs / 2)];

  const positions: number[] = [];
  for (const fraction of CANDIDATE_FRACTIONS) {
    const at = Math.min(latest, Math.max(EDGE_GUARD_MS, Math.round(fraction * durationMs)));
    if (positions.every((p) => Math.abs(p - at) >= DEDUPE_MS)) positions.push(at);
  }
  return positions;
}

/** Deterministic name so a thumbnail can be found on disk without a DB round trip. */
export function thumbFileName(videoId: string, width: number): string {
  return `${videoId.replace(/[^a-zA-Z0-9_-]/g, '_')}@${width}.jpg`;
}

/**
 * Whether this video should be (re)processed. A missing file counts as missing
 * even when the DB has a uri — Android used to evict these from the cache dir,
 * and a stale row should not leave a permanent hole in the grid.
 */
export function needsThumbnail(state: ThumbState | undefined, fileExists: boolean): boolean {
  if (!state) return true;
  if (state.version < THUMB_VERSION) return true; // new algorithm: everyone gets another go
  if (state.attempts >= THUMB_MAX_ATTEMPTS) return false;
  return !state.uri || !fileExists;
}

/** What `getOrCreateThumbnail` should do once it knows the state and the file. */
export type ThumbAction = 'serve' | 'generate' | 'give-up';

/**
 * Pure guard logic for `getOrCreateThumbnail`. Card and non-card widths must
 * diverge here: `thumb_version`/`thumb_attempts`/`thumb_uri` are written *only* by
 * the card path (`setThumbResult`/`recordThumbFailure`), so they describe the card
 * file, never a hero-sized one. A non-card request therefore cannot use
 * `needsThumbnail` — a video whose card has never been generated has
 * `thumb_version = 0` forever from the hero's point of view, which would make the
 * hero regenerate on every single call, uncapped, even once its own file is
 * already sitting on disk correctly.
 *
 * Instead, for a non-card width: a file present on disk is authoritative (serve
 * it without consulting version at all), and the attempts cap only matters when
 * there is no file — once the card path has exhausted `THUMB_MAX_ATTEMPTS`, a
 * non-card request with nothing on disk gives up too rather than decoding again.
 * A `THUMB_VERSION` bump still reaches the hero: the card path deletes the other
 * widths' files whenever it writes a new frame (see `thumbnails.ts`), which turns
 * "file present" back into "file absent" and lets this function say `generate`
 * again on the next request — no non-card write to the `videos` row required.
 */
export function decideThumbAction(
  state: ThumbState | undefined,
  fileExists: boolean,
  isCard: boolean,
): ThumbAction {
  if (!isCard) {
    if (fileExists) return 'serve';
    const cardExhausted =
      state != null && state.version >= THUMB_VERSION && state.attempts >= THUMB_MAX_ATTEMPTS;
    return cardExhausted ? 'give-up' : 'generate';
  }

  if (fileExists && !needsThumbnail(state, true)) return 'serve';
  if (!needsThumbnail(state, fileExists)) return fileExists ? 'serve' : 'give-up';
  return 'generate';
}

/**
 * Which of a video's other-width thumbnail files are safe to delete after the
 * card path writes a fresh frame. A width currently being generated in this
 * process is excluded: `THUMB_VERSION` is a compile-time constant, so anything
 * decoding right now is already running the current algorithm — it is by
 * definition not stale, and deleting it would race the native writer's
 * `FileOutputStream` (which has no atomic rename) rather than clean up a
 * genuinely outdated file. Everything else in `otherWidths` — sitting on disk,
 * not currently being written — is still deleted, which is how a `THUMB_VERSION`
 * bump (or a corrected card frame) eventually reaches those sizes without any of
 * them writing to the `videos` row themselves.
 */
export function siblingWidthsToDelete(
  otherWidths: number[],
  inFlightWidths: ReadonlySet<number>,
): number[] {
  return otherWidths.filter((width) => !inFlightWidths.has(width));
}
