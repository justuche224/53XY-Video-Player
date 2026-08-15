import { selectionQueueIds, resolveQueueItems } from '../queue';
import type { Group, LibraryVideo } from '@/library/types';

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

const group = (key: string, ids: string[]): Group => ({
  key,
  title: key,
  kind: 'name',
  items: ids.map(vid),
  count: ids.length,
});

const byId = (vids: LibraryVideo[]) => new Map(vids.map((v) => [v.id, v]));

describe('selectionQueueIds', () => {
  it('flattens selected groups in on-screen order, items in their own order', () => {
    const groups = [group('g1', ['a', 'b']), group('g2', ['c']), group('g3', ['d', 'e'])];
    expect(selectionQueueIds(groups, new Set(['g3', 'g1']))).toEqual(['a', 'b', 'd', 'e']);
  });

  it('ignores selection keys with no matching group', () => {
    const groups = [group('g1', ['a'])];
    expect(selectionQueueIds(groups, new Set(['g1', 'gone']))).toEqual(['a']);
  });

  it('returns an empty queue when nothing is selected', () => {
    expect(selectionQueueIds([group('g1', ['a'])], new Set())).toEqual([]);
  });
});

describe('resolveQueueItems', () => {
  it('resolves ids against the video cache, preserving queue order', () => {
    const result = resolveQueueItems(['b', 'a'], byId([vid('a'), vid('b')]));
    expect(result.map((v) => v.id)).toEqual(['b', 'a']);
  });

  it('drops ids whose video was deleted', () => {
    const result = resolveQueueItems(['a', 'gone', 'b'], byId([vid('a'), vid('b')]));
    expect(result.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns an empty array for an empty queue', () => {
    expect(resolveQueueItems([], byId([vid('a')]))).toEqual([]);
  });
});
