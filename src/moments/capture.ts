import type {
  GrabFrameOptions,
  GrabFrameResult,
} from '../../modules/frame-grabber/src/FrameGrabberModule';
import { momentDisplay } from './moment-title';
import { MOMENT_QUALITY, MOMENT_WIDTH } from './moment-policy';
import { framePath } from './moments-dir';
import type { Moment } from './types';

/** The subset of a library video a capture needs. */
export interface CaptureVideo {
  id: string;
  uri: string;
  filename: string;
  folder: string | null;
  durationMs: number | null;
}

export interface CaptureInput {
  video: CaptureVideo;
  positionMs: number;
  /** The on-screen subtitle line, or '' when none is showing. */
  note: string;
}

/**
 * Collaborators are injected rather than imported so the whole pipeline is
 * testable without a device: the native grabber, the database and the
 * filesystem all arrive as plain functions.
 */
export interface CaptureDeps {
  grabFrame: (uri: string, options: GrabFrameOptions) => Promise<GrabFrameResult | null>;
  insert: (moment: Moment) => Promise<void>;
  /** Rewrites moments.json from the current table. */
  syncManifest: () => Promise<void>;
  momentsDir: string;
  now: () => number;
  newId: () => string;
}

export async function captureMoment(
  { video, positionMs, note }: CaptureInput,
  deps: CaptureDeps,
): Promise<Moment> {
  const id = deps.newId();
  const outPath = framePath(deps.momentsDir, id);
  const { title, episodeLabel } = momentDisplay(video.filename);

  // A missing frame is a degraded moment, not a failed one: the position, the
  // title and the note are what make it findable again.
  let frameUri: string | null = null;
  try {
    const result = await deps.grabFrame(video.uri, {
      positionsMs: [positionMs],
      targetWidth: MOMENT_WIDTH,
      // 0 disables the black/flat-frame rejection that poster selection wants.
      // The user pointed at this frame; second-guessing it is the bug.
      minScore: 0,
      quality: MOMENT_QUALITY,
      exact: true,
      outPath,
    });
    frameUri = result?.uri ?? null;
  } catch {
    frameUri = null;
  }

  const moment: Moment = {
    id,
    videoId: video.id,
    positionMs,
    createdAt: deps.now(),
    frameUri,
    note: note.trim() || null,
    title,
    episodeLabel,
    filename: video.filename,
    folder: video.folder,
    videoUri: video.uri,
    durationMs: video.durationMs,
  };

  await deps.insert(moment);

  // The row is already durable in SQLite, so a manifest failure must not turn
  // a successful capture into an error the user sees. The next capture or note
  // edit rewrites it.
  try {
    await deps.syncManifest();
  } catch {
    // intentionally swallowed
  }

  return moment;
}
