import { applyFilters, applyFolderFilter, applyNameFilter, EMPTY_FILTER } from '../filter-videos';
import type { LibraryVideo } from '../types';

const v = (id: string, filename: string, folder: string, durationMs: number | null = 60_000): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename,
  durationMs,
  width: null,
  height: null,
  folder,
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const ids = (vs: LibraryVideo[]) => vs.map((x) => x.id);

const vids = [
  v('a', 'trailer.mp4', '/DCIM/Camera'),
  v('b', 'movie.mkv', '/Movies'),
  v('c', 'VID_001.mp4', '/WhatsApp'),
  v('d', 'show.mp4', '/Movies'),
];

describe('applyNameFilter', () => {
  it('hides videos matching ANY pattern', () => {
    expect(ids(applyNameFilter(vids, ['trailer', 'VID_*']))).toEqual(['b', 'd']);
  });
  it('empty patterns is a pass-through (same ref)', () => {
    expect(applyNameFilter(vids, [])).toBe(vids);
  });
});

describe('applyFolderFilter', () => {
  it('hides videos in an ignored folder', () => {
    expect(ids(applyFolderFilter(vids, ['/Movies']))).toEqual(['a', 'c']);
  });
  it('empty list is a pass-through (same ref)', () => {
    expect(applyFolderFilter(vids, [])).toBe(vids);
  });
});

describe('applyFilters', () => {
  it('composes length + name + folder', () => {
    const filter = {
      minDurationMs: null,
      maxDurationMs: null,
      namePatterns: ['VID_*'], // hides c
      ignoredFolders: ['/DCIM/Camera'], // hides a
    };
    expect(ids(applyFilters(vids, filter))).toEqual(['b', 'd']);
  });
  it('empty filter is a pass-through (same ref)', () => {
    expect(applyFilters(vids, EMPTY_FILTER)).toBe(vids);
  });
});
