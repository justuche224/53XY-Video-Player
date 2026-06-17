import { groupByName, groupByFolder } from '../group-videos';
import type { LibraryVideo } from '../types';

function v(partial: Partial<LibraryVideo> & { id: string; filename: string }): LibraryVideo {
  return {
    uri: `file:///storage/emulated/0/Movies/${partial.filename}`,
    durationMs: 1000,
    width: 1280,
    height: 720,
    folder: '/storage/emulated/0/Movies',
    thumbUri: null,
    createdAt: 0,
    modifiedAt: 0,
    ...partial,
  };
}

describe('groupByName', () => {
  it('clusters episodes of the same show and sorts by season/episode', () => {
    const videos = [
      v({ id: '2', filename: 'Banshee S02E01 GalaxyTV.mkv' }),
      v({ id: '1', filename: 'Banshee S01E02 GalaxyTV.mkv' }),
      v({ id: '0', filename: 'Banshee S01E01 GalaxyTV.mkv' }),
      v({ id: '9', filename: 'Citadel S01E03.mp4' }),
    ];
    const groups = groupByName(videos);
    expect(groups.map((g) => g.title)).toEqual(['Banshee', 'Citadel']);
    const banshee = groups.find((g) => g.title === 'Banshee')!;
    expect(banshee.count).toBe(3);
    expect(banshee.items.map((i) => i.id)).toEqual(['0', '1', '2']);
  });

  it('keeps a standalone movie as its own group of one', () => {
    const groups = groupByName([v({ id: 'm', filename: 'The Best Man Holiday 2013 1080p.mp4' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('The Best Man Holiday');
    expect(groups[0].count).toBe(1);
  });
});

describe('groupByFolder', () => {
  it('groups by folder path with the folder name as title', () => {
    const videos = [
      v({ id: 'a', filename: 'e2.mkv', folder: '/storage/emulated/0/Movies/Banshee' }),
      v({ id: 'b', filename: 'e1.mkv', folder: '/storage/emulated/0/Movies/Banshee' }),
      v({ id: 'c', filename: 'clip.mp4', folder: '/storage/emulated/0/DCIM/Camera' }),
    ];
    const groups = groupByFolder(videos);
    expect(groups.map((g) => g.title)).toEqual(['Banshee', 'Camera']);
    const banshee = groups.find((g) => g.title === 'Banshee')!;
    expect(banshee.key).toBe('/storage/emulated/0/Movies/Banshee');
    expect(banshee.items.map((i) => i.id)).toEqual(['b', 'a']);
  });
});
