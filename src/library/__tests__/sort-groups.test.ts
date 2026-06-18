import { groupDate, groupLengthMs, DEFAULT_DIR, SORT_KEYS, SORT_LABELS, sortGroups } from '../sort-groups';
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

const titles = (gs: Group[]) => gs.map((g) => g.title);

describe('sort config', () => {
  it('exposes the four keys, labels, and default directions', () => {
    expect(SORT_KEYS).toEqual(['name', 'length', 'dateAdded', 'dateModified']);
    expect(SORT_LABELS.dateAdded).toBe('Date added');
    expect(DEFAULT_DIR).toEqual({ name: 'asc', length: 'desc', dateAdded: 'desc', dateModified: 'desc' });
  });
});

describe('sortGroups', () => {
  const a = grp('Banshee', [vid('a', 1000, 100)]);
  const b = grp('Citadel', [vid('b', 3000, 300)]);
  const c = grp('Alpha', [vid('c', 2000, 200)]);

  it('name asc is A→Z, desc is Z→A', () => {
    expect(titles(sortGroups([a, b, c], { key: 'name', dir: 'asc' }))).toEqual(['Alpha', 'Banshee', 'Citadel']);
    expect(titles(sortGroups([a, b, c], { key: 'name', dir: 'desc' }))).toEqual(['Citadel', 'Banshee', 'Alpha']);
  });

  it('length asc is shortest first, desc is longest first', () => {
    expect(titles(sortGroups([a, b, c], { key: 'length', dir: 'asc' }))).toEqual(['Banshee', 'Alpha', 'Citadel']);
    expect(titles(sortGroups([a, b, c], { key: 'length', dir: 'desc' }))).toEqual(['Citadel', 'Alpha', 'Banshee']);
  });

  it('dateAdded desc is newest first', () => {
    expect(titles(sortGroups([a, b, c], { key: 'dateAdded', dir: 'desc' }))).toEqual(['Citadel', 'Alpha', 'Banshee']);
  });

  it('groups with no date sort last in both directions', () => {
    const noDate = grp('Zeta', [vid('z', 500, null)]);
    expect(titles(sortGroups([noDate, a], { key: 'dateAdded', dir: 'desc' }))).toEqual(['Banshee', 'Zeta']);
    expect(titles(sortGroups([noDate, a], { key: 'dateAdded', dir: 'asc' }))).toEqual(['Banshee', 'Zeta']);
  });

  it('ties break by title A→Z', () => {
    const x = grp('Xander', [vid('x', 1000, 100)]);
    const y = grp('Aria', [vid('y', 1000, 100)]);
    // equal length and date → title order regardless of dir sign on the primary key
    expect(titles(sortGroups([x, y], { key: 'length', dir: 'desc' }))).toEqual(['Aria', 'Xander']);
  });

  it('returns a new array (does not mutate input)', () => {
    const input = [b, a];
    const out = sortGroups(input, { key: 'name', dir: 'asc' });
    expect(out).not.toBe(input);
    expect(titles(input)).toEqual(['Citadel', 'Banshee']);
  });
});
