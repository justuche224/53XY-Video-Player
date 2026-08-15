import { resolveLastPlayed } from '../resume-last';
import type { LibraryVideo } from '@/library/types';
import type { HistoryRow } from '@/db/history-repo';

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

const row = (videoId: string, lastPlayedAt: number): HistoryRow => ({
  videoId,
  positionMs: 0,
  percent: 0,
  completed: false,
  lastPlayedAt,
});

const byId = (vids: LibraryVideo[]) => new Map(vids.map((v) => [v.id, v]));

describe('resolveLastPlayed', () => {
  it('returns the most-recent video when it still exists', () => {
    const rows = [row('a', 200), row('b', 100)];
    const result = resolveLastPlayed(rows, byId([vid('a'), vid('b')]));
    expect(result?.id).toBe('a');
  });

  it('skips a deleted most-recent and returns the next existing video', () => {
    const rows = [row('gone', 200), row('b', 100)];
    const result = resolveLastPlayed(rows, byId([vid('b')]));
    expect(result?.id).toBe('b');
  });

  it('returns null when there are no rows', () => {
    expect(resolveLastPlayed([], byId([vid('a')]))).toBeNull();
  });

  it('returns null when every row points to a deleted video', () => {
    const rows = [row('gone1', 200), row('gone2', 100)];
    expect(resolveLastPlayed(rows, byId([]))).toBeNull();
  });

  it('returns the full LibraryVideo object (not just the id)', () => {
    const result = resolveLastPlayed([row('a', 1)], byId([vid('a')]));
    expect(result).toEqual(vid('a'));
  });
});
