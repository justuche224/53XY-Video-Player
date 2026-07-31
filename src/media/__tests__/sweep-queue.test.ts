import { buildSweepQueue } from '../sweep-queue';

const lib = (...ids: string[]) => ids.map((id) => ({ id }));

describe('buildSweepQueue', () => {
  it('puts recently played videos first, in recency order', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c', 'd'), new Set(['a', 'b', 'c', 'd']), ['c', 'a']);
    expect(queue).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores recently played videos that already have a thumbnail', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c'), new Set(['b']), ['c', 'a']);
    expect(queue).toEqual(['b']);
  });

  it('keeps library order for everything not recently played', () => {
    const queue = buildSweepQueue(lib('a', 'b', 'c'), new Set(['a', 'b', 'c']), []);
    expect(queue).toEqual(['a', 'b', 'c']);
  });

  it('never repeats a video that is both recent and in the library', () => {
    const queue = buildSweepQueue(lib('a', 'b'), new Set(['a', 'b']), ['a', 'a', 'b']);
    expect(queue).toEqual(['a', 'b']);
  });

  it('drops recent ids that are no longer in the library', () => {
    const queue = buildSweepQueue(lib('a'), new Set(['a', 'gone']), ['gone', 'a']);
    expect(queue).toEqual(['a']);
  });

  it('returns nothing when everything is done', () => {
    expect(buildSweepQueue(lib('a', 'b'), new Set(), ['a'])).toEqual([]);
  });
});
