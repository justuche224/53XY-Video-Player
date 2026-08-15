import type { ProgressMap } from '@/db/progress-repo';

export interface WatchToggle {
  label: 'Mark as played' | 'Mark as unplayed';
  markPlayed: boolean;
}

// "Played" is the sticky `completed` flag, set at write time by isCompleted()
// (>= 0.95) or by Mark as played. Reading the flag rather than the percent is
// what keeps a video you are re-watching from reverting to "Mark as played".
export function resolveWatchToggle(selectedIds: string[], progress: ProgressMap): WatchToggle {
  const allPlayed =
    selectedIds.length > 0 &&
    selectedIds.every((id) => progress.get(id)?.completed === true);

  return allPlayed
    ? { label: 'Mark as unplayed', markPlayed: false }
    : { label: 'Mark as played', markPlayed: true };
}
