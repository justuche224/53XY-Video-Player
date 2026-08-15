import type { ProgressMap } from '@/db/progress-repo';
import type { LibraryVideo } from '@/library/types';

/**
 * Whether a whole group counts as watched: every item completed, and at least
 * one item to begin with. Reads the sticky `completed` flag rather than
 * `percent`, so a show you are re-watching keeps its mark.
 */
export function groupWatched(items: LibraryVideo[], progress: ProgressMap): boolean {
  if (items.length === 0) return false;
  return items.every((item) => progress.get(item.id)?.completed === true);
}
