import { resolvePlaylistItems } from '../resolve-items';
import type { LibraryVideo } from '@/library/types';
import type { PlaylistItemRow } from '@/db/playlists-repo';

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

const item = (videoId: string, sortOrder: number): PlaylistItemRow => ({
  videoId,
  sortOrder,
});

const byId = (vids: LibraryVideo[]) => new Map(vids.map((v) => [v.id, v]));

describe('resolvePlaylistItems', () => {
  it('joins items against the video cache in sort order', () => {
    const items = [item('b', 0), item('a', 1)];
    const result = resolvePlaylistItems(items, byId([vid('a'), vid('b')]));
    expect(result.map((v) => v.id)).toEqual(['b', 'a']);
  });

  it('drops items whose video was deleted', () => {
    const items = [item('a', 0), item('gone', 1), item('b', 2)];
    const result = resolvePlaylistItems(items, byId([vid('a'), vid('b')]));
    expect(result.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('returns empty array for no items', () => {
    expect(resolvePlaylistItems([], byId([vid('a')]))).toEqual([]);
  });

  it('returns empty array when all items deleted', () => {
    const items = [item('gone1', 0), item('gone2', 1)];
    expect(resolvePlaylistItems(items, byId([]))).toEqual([]);
  });
});
