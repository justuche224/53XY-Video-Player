import { applyLengthFilter, EMPTY_FILTER, type LibraryFilter } from '../filter-videos';
import type { LibraryVideo } from '../types';

const v = (id: string, durationMs: number | null): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename: `${id}.mp4`,
  durationMs,
  width: null,
  height: null,
  folder: 'Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const ids = (vs: LibraryVideo[]) => vs.map((x) => x.id);

describe('applyLengthFilter', () => {
  const vids = [v('a', 5_000), v('b', 30_000), v('c', 3_600_000), v('d', null)];

  it('empty filter returns the same array reference (pass-through)', () => {
    expect(applyLengthFilter(vids, EMPTY_FILTER)).toBe(vids);
  });

  it('min only hides videos strictly shorter than min', () => {
    const f: LibraryFilter = { minDurationMs: 30_000, maxDurationMs: null, namePatterns: [], ignoredFolders: [] };
    // 'a' (5s) hidden; 'b' (exactly 30s) kept; 'c' kept; 'd' (unknown) kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['b', 'c', 'd']);
  });

  it('max only hides videos strictly longer than max', () => {
    const f: LibraryFilter = { minDurationMs: null, maxDurationMs: 3_600_000, namePatterns: [], ignoredFolders: [] };
    // 'c' (exactly 1h) kept; nothing over 1h here → all kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('both min and max keep only the in-range, plus unknown', () => {
    const f: LibraryFilter = { minDurationMs: 10_000, maxDurationMs: 60_000, namePatterns: [], ignoredFolders: [] };
    // 'a'(5s) hidden, 'b'(30s) kept, 'c'(1h) hidden, 'd'(unknown) kept
    expect(ids(applyLengthFilter(vids, f))).toEqual(['b', 'd']);
  });

  it('never hides videos with unknown (null) duration', () => {
    const f: LibraryFilter = { minDurationMs: 1_000_000, maxDurationMs: 2_000_000, namePatterns: [], ignoredFolders: [] };
    expect(ids(applyLengthFilter(vids, f))).toContain('d');
  });
});
