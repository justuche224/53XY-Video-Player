import type { HistoryRow } from '@/db/history-repo';
import type { LibraryVideo } from '@/library/types';

/**
 * Walk history (already ordered newest-first) and return the first entry whose
 * video still exists in the library cache. Returns null when none resolve —
 * e.g. empty history, or every played video has since been deleted.
 */
export function resolveLastPlayed(
  rows: HistoryRow[],
  videosById: Map<string, LibraryVideo>,
): LibraryVideo | null {
  for (const row of rows) {
    const video = videosById.get(row.videoId);
    if (video) return video;
  }
  return null;
}
