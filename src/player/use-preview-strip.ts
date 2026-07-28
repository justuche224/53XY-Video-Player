// src/player/use-preview-strip.ts
import { useEffect, useMemo, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { getThumbnailAsync } from 'expo-video-thumbnails';

import { getPreviewFrames, insertPreviewFrame } from '@/db/preview-frames-repo';
import {
  frameCount,
  frameTimeMs,
  previewIntervalSec,
} from '@/player/preview-strip';

/** Pause between frame extractions so generation stays a background chore. */
const GENERATION_GAP_MS = 250;
const FRAME_QUALITY = 0.3;

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
      let completed: Map<number, string>;
      try {
        completed = await getPreviewFrames(db, videoId);
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
          const { uri: frameUri } = await getThumbnailAsync(uri, {
            time: timeMs,
            quality: FRAME_QUALITY,
          });
          if (cancelled) return;
          await insertPreviewFrame(db, videoId, idx, timeMs, frameUri);
          completed.set(idx, frameUri);
          setFrames(new Map(completed));
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
