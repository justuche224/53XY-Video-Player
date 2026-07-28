// src/player/use-preview-strip.ts
import { useEffect, useRef, useState } from 'react';
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
  // One generation loop per videoId — duration updates must not spawn a second.
  const generatingForRef = useRef<string | null>(null);

  const intervalSec = durationSec > 0 ? previewIntervalSec(durationSec) : 0;
  const count = durationSec > 0 ? frameCount(durationSec, intervalSec) : 0;

  useEffect(() => {
    setFrames(new Map());
    generatingForRef.current = null;
  }, [videoId]);

  useEffect(() => {
    if (durationSec <= 0 || count <= 0) return;
    if (generatingForRef.current === videoId) return;
    generatingForRef.current = videoId;

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
        const timeMs = frameTimeMs(idx, intervalSec, durationSec);
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
      // Allow resume if the same video re-mounts (e.g. prev/next back to it).
      generatingForRef.current = null;
    };
    // intervalSec/count derive from durationSec; videoId gates the loop.
  }, [db, videoId, uri, durationSec, intervalSec, count]);

  return { intervalSec, count, frames };
}
