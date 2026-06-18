import { groupDate, groupLengthMs } from '../sort-groups';
import type { Group, LibraryVideo } from '../types';

const vid = (
  id: string,
  durationMs: number | null,
  createdAt: number | null = null,
  modifiedAt: number | null = null,
): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt,
  modifiedAt,
});

const grp = (title: string, items: LibraryVideo[]): Group => ({
  key: title.toLowerCase(),
  title,
  kind: 'name',
  items,
  count: items.length,
});

describe('groupLengthMs', () => {
  it('sums item durations, treating null as 0', () => {
    expect(groupLengthMs(grp('A', [vid('a', 1000), vid('b', null), vid('c', 500)]))).toBe(1500);
  });
  it('is 0 for an empty group', () => {
    expect(groupLengthMs(grp('A', []))).toBe(0);
  });
});

describe('groupDate', () => {
  it('returns the newest item date for the field', () => {
    const g = grp('A', [vid('a', 0, 100, 5), vid('b', 0, 300, 9), vid('c', 0, 200, 1)]);
    expect(groupDate(g, 'createdAt')).toBe(300);
    expect(groupDate(g, 'modifiedAt')).toBe(9);
  });
  it('returns null when no item has the date', () => {
    expect(groupDate(grp('A', [vid('a', 0, null, null)]), 'createdAt')).toBeNull();
  });
});
