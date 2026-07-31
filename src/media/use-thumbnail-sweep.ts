import { usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getHistory } from '@/db/history-repo';
import { getThumbStates } from '@/db/thumbs-repo';
import { useLibraryData } from '@/library/library-provider';
import { buildSweepQueue } from './sweep-queue';
import { getOrCreateThumbnail, hasThumbnailFile } from './thumbnails';
import { needsThumbnail } from './thumb-policy';

/** Gap between extractions — this is a chore, not a job. */
const SWEEP_GAP_MS = 300;
/** How long to wait before re-checking whether the sweep may resume. */
const PAUSE_POLL_MS = 2000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Works through every video still missing a thumbnail, one at a time, so a
 * library you have never scrolled through still ends up fully illustrated.
 *
 * Pauses while the app is backgrounded and while the player is on screen —
 * frame extraction and video playback want the same hardware decoder, and the
 * user is looking at the playback.
 */
export function useThumbnailSweep(): void {
  const db = useSQLiteContext();
  const { videos, status } = useLibraryData();
  const pathname = usePathname();

  const foregrounded = useRef(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      foregrounded.current = next === 'active';
    });
    return () => sub.remove();
  }, []);

  const playerOpen = useRef(false);
  playerOpen.current = pathname === '/player';

  useEffect(() => {
    if (status !== 'ready' || videos.length === 0) return;
    let cancelled = false;

    (async () => {
      const [states, history] = await Promise.all([getThumbStates(db), getHistory(db)]);
      if (cancelled) return;

      const pending = new Set(
        videos
          .filter((v) => needsThumbnail(states.get(v.id), hasThumbnailFile(v.id)))
          .map((v) => v.id),
      );
      const queue = buildSweepQueue(videos, pending, history.map((h) => h.videoId));
      const byId = new Map(videos.map((v) => [v.id, v]));

      for (const id of queue) {
        while (!cancelled && (!foregrounded.current || playerOpen.current)) {
          await delay(PAUSE_POLL_MS);
        }
        if (cancelled) return;

        const video = byId.get(id);
        if (!video) continue;
        // One unreadable file (or a DB hiccup) must not end the whole sweep —
        // the attempt is already recorded, so the next pass skips it anyway.
        await getOrCreateThumbnail(db, video).catch(() => null);
        if (cancelled) return;
        await delay(SWEEP_GAP_MS);
      }
    })();

    return () => {
      cancelled = true;
    };
    // A rescan produces a new `videos` array and restarts the sweep. That is
    // cheap and correct: state is re-read, and finished videos are skipped.
  }, [db, status, videos]);
}
