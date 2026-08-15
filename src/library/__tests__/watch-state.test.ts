import { groupWatched } from '../watch-state';
import type { ProgressMap } from '@/db/progress-repo';
import type { LibraryVideo } from '@/library/types';

const vid = (id: string): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs: 1000,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const progressMap = (entries: Array<[string, boolean]>): ProgressMap => {
  const map: ProgressMap = new Map();
  for (const [id, completed] of entries) {
    map.set(id, { positionMs: 0, percent: completed ? 1 : 0.4, completed });
  }
  return map;
};

describe('groupWatched', () => {
  it('is true when every item is completed', () => {
    const items = [vid('a'), vid('b')];
    expect(groupWatched(items, progressMap([['a', true], ['b', true]]))).toBe(true);
  });

  it('is false when a single item is unwatched', () => {
    const items = [vid('a'), vid('b')];
    expect(groupWatched(items, progressMap([['a', true], ['b', false]]))).toBe(false);
  });

  it('is false when an item has no progress row at all', () => {
    const items = [vid('a'), vid('b')];
    expect(groupWatched(items, progressMap([['a', true]]))).toBe(false);
  });

  // A finished video that is being re-watched sits at a low percent but keeps
  // its completed flag — the badge must follow the flag, not the bar.
  it('stays true for a completed item that is being re-watched', () => {
    const items = [vid('a')];
    const map: ProgressMap = new Map([['a', { positionMs: 5000, percent: 0.02, completed: true }]]);
    expect(groupWatched(items, map)).toBe(true);
  });

  it('is false for an empty group', () => {
    expect(groupWatched([], progressMap([]))).toBe(false);
  });
});
