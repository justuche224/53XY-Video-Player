import { stashQueue, getQueue } from '../queue-store';

describe('queue store', () => {
  it('returns the stashed ids for the token it handed out', () => {
    const token = stashQueue(['a', 'b', 'c']);
    expect(getQueue(token)).toEqual(['a', 'b', 'c']);
  });

  it('returns null for a token it never handed out', () => {
    expect(getQueue('nope')).toBeNull();
  });

  it('hands out a fresh token per stash and forgets the previous queue', () => {
    const first = stashQueue(['a']);
    const second = stashQueue(['b']);
    expect(second).not.toBe(first);
    expect(getQueue(first)).toBeNull();
    expect(getQueue(second)).toEqual(['b']);
  });
});
