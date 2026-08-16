import { findSubtitleCandidates, pickAutoLoad } from '../find-sibling';
import type { DirectoryEntry } from '../find-sibling';

function files(...names: string[]): DirectoryEntry[] {
  return names.map((name) => ({ name, isDirectory: false }));
}

describe('findSubtitleCandidates', () => {
  it('ranks an exact basename match best', () => {
    const found = findSubtitleCandidates('Movie.mkv', files('Movie.mkv', 'Movie.srt'), null);
    expect(found).toEqual([
      { relativePath: 'Movie.srt', name: 'Movie.srt', rank: 0, lang: null },
    ]);
  });

  it('ranks language-suffixed files just below', () => {
    const found = findSubtitleCandidates('Movie.mkv', files('Movie.en.srt', 'Movie.eng.srt'), null);
    expect(found.map((c) => [c.name, c.rank, c.lang])).toEqual([
      ['Movie.en.srt', 1, 'en'],
      ['Movie.eng.srt', 1, 'eng'],
    ]);
  });

  it('ranks forced and SDH below full tracks', () => {
    const found = findSubtitleCandidates(
      'Movie.mkv',
      files('Movie.en.forced.srt', 'Movie.forced.srt', 'Movie.en.sdh.srt'),
      null,
    );
    expect(found.every((c) => c.rank === 2)).toBe(true);
  });

  it('ranks other prefix matches last', () => {
    const found = findSubtitleCandidates('Movie.mkv', files('Movie - Track 2.srt'), null);
    expect(found[0].rank).toBe(3);
  });

  it('ignores unrelated names and non-subtitle files', () => {
    const found = findSubtitleCandidates(
      'Movie.mkv',
      files('Other.srt', 'Movie.mkv', 'Movie.nfo', 'notes.txt'),
      null,
    );
    expect(found).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const found = findSubtitleCandidates('MOVIE.mkv', files('movie.SRT'), null);
    expect(found[0].rank).toBe(0);
  });

  it('skips directories', () => {
    const entries = [...files('Movie.srt'), { name: 'Movie.srt.d', isDirectory: true }];
    expect(findSubtitleCandidates('Movie.mkv', entries, null)).toHaveLength(1);
  });

  it('takes every subtitle in Subs/ when the folder holds exactly one video', () => {
    const found = findSubtitleCandidates('Movie.mkv', files('Movie.mkv'), {
      name: 'Subs',
      entries: files('2_English.srt', '3_Spanish.srt'),
    });
    expect(found.map((c) => [c.relativePath, c.rank])).toEqual([
      ['Subs/2_English.srt', 4],
      ['Subs/3_Spanish.srt', 4],
    ]);
  });

  it('does NOT take unmatched Subs/ files when the folder holds several videos', () => {
    const found = findSubtitleCandidates('S01E01.mkv', files('S01E01.mkv', 'S01E02.mkv'), {
      name: 'Subs',
      entries: files('2_English.srt'),
    });
    expect(found).toEqual([]);
  });

  it('still name-matches inside Subs/ when the folder holds several videos', () => {
    const found = findSubtitleCandidates('S01E01.mkv', files('S01E01.mkv', 'S01E02.mkv'), {
      name: 'Subs',
      entries: files('S01E01.en.srt', 'S01E02.en.srt'),
    });
    expect(found.map((c) => c.relativePath)).toEqual(['Subs/S01E01.en.srt']);
  });

  it('sorts by rank then name', () => {
    const found = findSubtitleCandidates(
      'Movie.mkv',
      files('Movie - extra.srt', 'Movie.fr.srt', 'Movie.srt', 'Movie.en.srt'),
      null,
    );
    expect(found.map((c) => c.name)).toEqual([
      'Movie.srt',
      'Movie.en.srt',
      'Movie.fr.srt',
      'Movie - extra.srt',
    ]);
  });

  it('treats a bare .hi suffix as Hindi rather than a hearing-impaired flag', () => {
    const found = findSubtitleCandidates('Movie.mkv', files('Movie.hi.srt'), null);
    expect(found.map((c) => [c.rank, c.lang])).toEqual([[1, 'hi']]);
  });
});

describe('pickAutoLoad', () => {
  const cand = (name: string, rank: number, lang: string | null) => ({
    relativePath: name,
    name,
    rank,
    lang,
  });

  it('returns null for no candidates', () => {
    expect(pickAutoLoad([], 'en')).toBeNull();
  });

  it('prefers the best rank', () => {
    expect(pickAutoLoad([cand('b.srt', 3, null), cand('a.srt', 0, null)], 'en')!.name).toBe('a.srt');
  });

  it('prefers a plain name over a language-suffixed one within a rank', () => {
    const picked = pickAutoLoad([cand('Movie.en.srt', 1, 'en'), cand('Movie.srt', 1, null)], 'en');
    expect(picked!.name).toBe('Movie.srt');
  });

  it('prefers the device language when every candidate is language-tagged', () => {
    const picked = pickAutoLoad([cand('a.fr.srt', 1, 'fr'), cand('b.en.srt', 1, 'en')], 'en');
    expect(picked!.name).toBe('b.en.srt');
  });

  it('matches a three-letter language token against a two-letter device locale', () => {
    const picked = pickAutoLoad([cand('a.fr.srt', 1, 'fr'), cand('b.eng.srt', 1, 'eng')], 'en');
    expect(picked!.name).toBe('b.eng.srt');
  });

  it('falls back to alphabetical when nothing matches the device language', () => {
    const picked = pickAutoLoad([cand('z.de.srt', 1, 'de'), cand('a.fr.srt', 1, 'fr')], 'en');
    expect(picked!.name).toBe('a.fr.srt');
  });
});
