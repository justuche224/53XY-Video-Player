/**
 * A captured scene. Deliberately self-contained: every field needed to render
 * a moment card is snapshotted here at capture time, so a moment survives its
 * source video being deleted from the library (see the spec's §2).
 */
export interface Moment {
  id: string;
  /** MediaStore id at capture time. A relink hint, not an ownership edge. */
  videoId: string | null;
  positionMs: number;
  createdAt: number;
  /** file:// uri of the saved JPEG; null when the frame grab failed. */
  frameUri: string | null;
  /** Seeded from the on-screen subtitle line, then user-editable. */
  note: string | null;
  // ── snapshot: written once, never refreshed ──
  title: string;
  episodeLabel: string | null;
  filename: string;
  folder: string | null;
  videoUri: string | null;
  durationMs: number | null;
}
