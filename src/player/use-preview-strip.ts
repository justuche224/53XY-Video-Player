// src/player/use-preview-strip.ts
import { useEffect, useMemo, useState } from 'react';
import { Directory, File, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';

import { getPreviewFrames, insertPreviewFrame } from '@/db/preview-frames-repo';
import { FrameGrabber } from '@/native/frame-grabber';
import {
  frameCount,
  frameTimeMs,
  previewIntervalSec,
} from '@/player/preview-strip';

/** Pause between frame extractions so generation stays a background chore. */
const GENERATION_GAP_MS = 250;
const FRAME_QUALITY = 0.5;
/** Wide enough for the scrub bubble at 2x DPR, small enough to be nearly free. */
const FRAME_WIDTH = 320;
/** Strip frames must land on their own slot, so any decodable frame is accepted. */
const FRAME_MIN_SCORE = 0;

/** Previews stay in the cache dir: they are per-session nice-to-haves, not library data. */
const PREVIEW_DIR = 'previews';

function previewFile(videoId: string, idx: number): File {
  const dir = new Directory(Paths.cache, PREVIEW_DIR, videoId);
  if (!dir.exists) dir.create({ intermediates: true });
  return new File(dir, `${idx}.jpg`);
}

export interface PreviewStrip {
  intervalSec: number;
  count: number;
  /** Completed frames by slot index. */
  frames: Map<number, string>;
}

/**
 * Loads (and lazily generates, one frame at a time) the scrub-preview strip
 * for a video. Generation starts once the duration is known, resumes where a
 * previous session stopped, and a partial strip is served immediately.
 */
export function usePreviewStrip(videoId: string, uri: string, durationSec: number): PreviewStrip {
  const db = useSQLiteContext();
  const [frames, setFrames] = useState<Map<number, string>>(new Map());

  // Whole-second duration: player.duration is re-set on every timeUpdate, and
  // any sub-second jitter would change intervalSec/count and cancel-restart
  // the generation loop. Flooring makes the deps stable once duration is known.
  const stableDurationSec = Math.floor(durationSec);
  const intervalSec = stableDurationSec > 0 ? previewIntervalSec(stableDurationSec) : 0;
  const count = stableDurationSec > 0 ? frameCount(stableDurationSec, intervalSec) : 0;

  useEffect(() => {
    setFrames(new Map());
  }, [videoId]);

  // Concurrency safety is the cancelled flag: a deps change (video switch,
  // first-known duration) cancels the old loop before the new one starts.
  useEffect(() => {
    if (stableDurationSec <= 0 || count <= 0) return;

    let cancelled = false;
    (async () => {
      const completed = new Map<number, string>();
      try {
        const stored = await getPreviewFrames(db, videoId);
        // A stored frame is only valid if it was captured for the CURRENT slot
        // math — density/interval changes re-index the slots, and reusing an
        // old capture would show a wrong frame. Mismatches regenerate below
        // (the insert upserts over the stale row).
        for (const [idx, frame] of stored) {
          if (
            idx < count &&
            Math.abs(frame.timeMs - frameTimeMs(idx, intervalSec, stableDurationSec)) <= 1000
          ) {
            completed.set(idx, frame.uri);
          }
        }
      } catch {
        return;
      }
      if (cancelled) return;
      if (completed.size > 0) setFrames(new Map(completed));

      for (let idx = 0; idx < count; idx++) {
        if (cancelled) return;
        if (completed.has(idx)) continue;
        const timeMs = frameTimeMs(idx, intervalSec, stableDurationSec);
        try {
          const result = await FrameGrabber.grabFrame(uri, {
            positionsMs: [timeMs],
            targetWidth: FRAME_WIDTH,
            minScore: FRAME_MIN_SCORE,
            quality: FRAME_QUALITY,
            outPath: previewFile(videoId, idx).uri,
          });
          if (cancelled) return;
          if (result) {
            await insertPreviewFrame(db, videoId, idx, timeMs, result.uri);
            completed.set(idx, result.uri);
            setFrames(new Map(completed));
          }
        } catch {
          // Extraction can fail on odd codecs/positions — skip the slot.
        }
        await new Promise((r) => setTimeout(r, GENERATION_GAP_MS));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db, videoId, uri, stableDurationSec, intervalSec, count]);

  // Stable object while nothing changed, so consumers can depend on it.
  return useMemo(() => ({ intervalSec, count, frames }), [intervalSec, count, frames]);
}
