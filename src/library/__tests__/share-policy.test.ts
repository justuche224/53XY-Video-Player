import { resolveShare, SHARE_CAP } from '../share-policy';

const ids = (n: number) =>
  Array.from({ length: n }, (_, i) => `content://media/external/video/media/${i}`);

describe('resolveShare', () => {
  it('reports an empty selection', () => {
    expect(resolveShare([])).toEqual({ kind: 'empty' });
  });

  it('shares a single item', () => {
    expect(resolveShare(ids(1))).toEqual({ kind: 'share', ids: ids(1) });
  });

  it('shares a selection exactly at the cap', () => {
    const result = resolveShare(ids(SHARE_CAP));
    expect(result).toEqual({ kind: 'share', ids: ids(SHARE_CAP) });
  });

  it('refuses one past the cap, reporting the count', () => {
    expect(resolveShare(ids(SHARE_CAP + 1))).toEqual({
      kind: 'too-many',
      count: SHARE_CAP + 1,
    });
  });

  // A refusal must not quietly become a partial share — the whole point of
  // the cap policy is that you get everything you picked, or nothing.
  it('never returns a trimmed id list', () => {
    const result = resolveShare(ids(SHARE_CAP + 10));
    expect(result.kind).toBe('too-many');
    expect(result).not.toHaveProperty('ids');
  });
});
