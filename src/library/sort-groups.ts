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

export type SortKey = 'name' | 'length' | 'dateAdded' | 'dateModified';
export type SortDir = 'asc' | 'desc';
export interface SortSpec {
  key: SortKey;
  dir: SortDir;
}

export const SORT_KEYS: SortKey[] = ['name', 'length', 'dateAdded', 'dateModified'];

export const SORT_LABELS: Record<SortKey, string> = {
  name: 'Name',
  length: 'Length',
  dateAdded: 'Date added',
  dateModified: 'Date modified',
};

export const DEFAULT_DIR: Record<SortKey, SortDir> = {
  name: 'asc',
  length: 'desc',
  dateAdded: 'desc',
  dateModified: 'desc',
};

function byTitleAsc(a: Group, b: Group): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

/**
 * Return a NEW array of groups ordered by the spec. Unknown (null) dates sort
 * last in both directions; equal primary values break by title A→Z.
 */
export function sortGroups(groups: Group[], spec: SortSpec): Group[] {
  const { key, dir } = spec;
  const sign = dir === 'asc' ? 1 : -1;
  return [...groups].sort((a, b) => {
    let cmp = 0;
    if (key === 'name') {
      cmp = sign * byTitleAsc(a, b);
    } else if (key === 'length') {
      cmp = sign * (groupLengthMs(a) - groupLengthMs(b));
    } else {
      const field = key === 'dateAdded' ? 'createdAt' : 'modifiedAt';
      const da = groupDate(a, field);
      const db = groupDate(b, field);
      if (da == null && db == null) cmp = 0;
      else if (da == null) return 1; // a unknown → after b
      else if (db == null) return -1; // b unknown → after a
      else cmp = sign * (da - db);
    }
    return cmp !== 0 ? cmp : byTitleAsc(a, b);
  });
}
