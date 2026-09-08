import { formatBytes, restorableMoments } from '../restore-moments';
import type { Moment } from '../types';

function moment(over: Partial<Moment> = {}): Moment {
  return {
    id: 'm1',
    videoId: 'v1',
    positionMs: 1000,
    createdAt: 5,
    frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
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

describe('restorableMoments', () => {
  const present = () => true;
  const absent = () => false;

  it('restores a moment whose frame is still on disk', () => {
    expect(restorableMoments([moment()], present)).toEqual([moment()]);
  });

  it('drops a moment whose frame file is gone', () => {
    // The row would restore pointing at nothing, rendering permanently broken.
    expect(restorableMoments([moment()], absent)).toEqual([]);
  });

  it('keeps a frameless moment, which never had a file to lose', () => {
    const frameless = moment({ frameUri: null });
    expect(restorableMoments([frameless], absent)).toEqual([frameless]);
  });

  it('checks each frame individually', () => {
    const a = moment({ id: 'a', frameUri: 'file:///a.jpg' });
    const b = moment({ id: 'b', frameUri: 'file:///b.jpg' });
    const only = (uri: string) => uri === 'file:///a.jpg';
    expect(restorableMoments([a, b], only).map((m) => m.id)).toEqual(['a']);
  });

  it('returns nothing for an empty manifest', () => {
    expect(restorableMoments([], present)).toEqual([]);
  });
});

describe('formatBytes', () => {
  it('shows plain bytes below a kilobyte', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('scales to KB and MB with one decimal', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(Math.round(1024 * 1024 * 3.5))).toBe('3.5 MB');
  });

  it('never renders a negative or non-finite size', () => {
    // A stat() failure must not put "NaN MB" in front of the user.
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });
});
