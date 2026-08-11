import type { ProgressMap } from '@/db/progress-repo';

export interface WatchToggle {
  label: 'Mark as played' | 'Mark as unplayed';
  markPlayed: boolean;
}

// >= 0.99 matches the "effectively complete" threshold already used elsewhere
// in the app (e.g. `groupPercent` in the Home screen treats < 0.99 as "still
// in progress").
export function resolveWatchToggle(selectedIds: string[], progress: ProgressMap): WatchToggle {
  const allPlayed =
    selectedIds.length > 0 &&
    selectedIds.every((id) => (progress.get(id)?.percent ?? 0) >= 0.99);

  return allPlayed
    ? { label: 'Mark as unplayed', markPlayed: false }
    : { label: 'Mark as played', markPlayed: true };
}
