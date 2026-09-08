import { chunkMoments, filterMoments, groupMoments } from '../group-moments';
import type { Moment } from '../types';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: null,
    note: null,
    title: 'Lanterns',
    episodeLabel: 'S01E03',
    filename: 'Lanterns.S01E03.mkv',
    folder: 'Movies',
    videoUri: null,
    durationMs: 2000,
    ...over,
  };
}

describe('groupMoments', () => {
  it('groups by title and keeps first-appearance order', () => {
    // Rows arrive newest-first from the repo, so the newest title leads.
    const sections = groupMoments([
      moment({ id: 'a', title: 'Lanterns' }),
      moment({ id: 'b', title: 'Inception' }),
      moment({ id: 'c', title: 'Lanterns' }),
    ]);
    expect(sections.map((s) => s.title)).toEqual(['Lanterns', 'Inception']);
    expect(sections[0].data.map((m) => m.id)).toEqual(['a', 'c']);
    expect(sections[1].data.map((m) => m.id)).toEqual(['b']);
  });

  it('returns nothing for no moments', () => {
    expect(groupMoments([])).toEqual([]);
  });

  it('gives each section a stable key', () => {
    const [section] = groupMoments([moment({ title: 'Lanterns' })]);
    expect(section.key).toBe('Lanterns');
  });
});

describe('filterMoments', () => {
  const sections = groupMoments([
    moment({ id: 'a', title: 'Lanterns', note: 'Happy birthday to you' }),
    moment({ id: 'b', title: 'Inception', note: null }),
  ]);

  it('returns everything for an empty query', () => {
    expect(filterMoments(sections, '   ')).toEqual(sections);
  });

  it('matches note text case-insensitively', () => {
    const out = filterMoments(sections, 'BIRTHDAY');
    expect(out.map((s) => s.title)).toEqual(['Lanterns']);
    expect(out[0].data.map((m) => m.id)).toEqual(['a']);
  });

  it('matches the title too', () => {
    expect(filterMoments(sections, 'incep').map((s) => s.title)).toEqual(['Inception']);
  });

  it('drops sections left with no matches', () => {
    expect(filterMoments(sections, 'nothing matches this')).toEqual([]);
  });

  it('does not match a null note', () => {
    // Guards against a `null.toLowerCase()` crash as much as the filtering.
    expect(filterMoments(sections, 'null')).toEqual([]);
  });
});

describe('chunkMoments', () => {
  it('splits into rows of the requested width', () => {
    const ms = [moment({ id: 'a' }), moment({ id: 'b' }), moment({ id: 'c' })];
    expect(chunkMoments(ms, 2).map((row) => row.map((m) => m.id))).toEqual([['a', 'b'], ['c']]);
  });

  it('returns no rows for no moments', () => {
    expect(chunkMoments([], 2)).toEqual([]);
  });

  it('never loops forever on a nonsense row width', () => {
    expect(chunkMoments([moment()], 0)).toEqual([[moment()]]);
  });
});
