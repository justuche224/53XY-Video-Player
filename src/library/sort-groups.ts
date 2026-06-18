import type { Group } from './types';

/** Total duration of a group in ms (item.durationMs ?? 0, summed). */
export function groupLengthMs(group: Group): number {
  return group.items.reduce((sum, v) => sum + (v.durationMs ?? 0), 0);
}

/** The newest item's value for the given date field, or null if no item has one. */
export function groupDate(group: Group, field: 'createdAt' | 'modifiedAt'): number | null {
  let max: number | null = null;
  for (const v of group.items) {
    const d = v[field];
    if (d != null && (max == null || d > max)) max = d;
  }
  return max;
}
