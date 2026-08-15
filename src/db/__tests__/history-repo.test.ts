import { getHistory, removeHistory, clearHistory, type HistoryRow } from '../history-repo';
import { deleteProgressByIds, upsertProgress } from '../progress-repo';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = []) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return undefined as never;
    },
    async getAllAsync<T>(sql: string) {
      calls.push({ sql });
      return rows as T[];
    },
  };
  return { db: db as never, calls };
}

describe('history-repo', () => {
  it('getHistory selects ordered by last_played_at desc and maps rows', async () => {
    const dbRows = [
      { video_id: 'a', position_ms: 10, percent: 0.5, completed: 1, last_played_at: 200 },
      { video_id: 'b', position_ms: 0, percent: 0, completed: 0, last_played_at: 100 },
    ];
    const { db, calls } = fakeDb(dbRows);
    const result: HistoryRow[] = await getHistory(db);
    expect(calls[0].sql).toMatch(/FROM watch_progress/);
    expect(calls[0].sql).toMatch(/ORDER BY last_played_at DESC/);
    expect(result).toEqual([
      { videoId: 'a', positionMs: 10, percent: 0.5, completed: true, lastPlayedAt: 200 },
      { videoId: 'b', positionMs: 0, percent: 0, completed: false, lastPlayedAt: 100 },
    ]);
  });

  it('removeHistory deletes a single row by id', async () => {
    const { db, calls } = fakeDb();
    await removeHistory(db, 'x');
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress WHERE video_id = \?/);
    expect(calls[0].params).toEqual(['x']);
  });

  it('clearHistory deletes all rows', async () => {
    const { db, calls } = fakeDb();
    await clearHistory(db);
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress/);
    expect(calls[0].sql).not.toMatch(/WHERE/);
  });
});

describe('upsertProgress', () => {
  // Re-watching a finished video walks percent back to ~0 and writes
  // completed: false with it. Taking excluded.completed would erase the fact
  // that it was ever watched on the first write of the replay, which is what
  // the badge reads.
  it('keeps an existing completed flag set when a later write clears it', async () => {
    const { db, calls } = fakeDb();
    await upsertProgress(db, 'a', {
      positionMs: 500,
      percent: 0.01,
      completed: false,
      lastPlayedAt: 1,
    });
    expect(calls[0].sql).toMatch(/completed = MAX\(watch_progress\.completed, excluded\.completed\)/);
  });
});

describe('deleteProgressByIds', () => {
  it('is a no-op on empty ids', async () => {
    const { db, calls } = fakeDb();
    await deleteProgressByIds(db, []);
    expect(calls).toEqual([]);
  });

  it('builds a placeholder IN clause with the ids as params', async () => {
    const { db, calls } = fakeDb();
    await deleteProgressByIds(db, ['a', 'b', 'c']);
    expect(calls[0].sql).toMatch(/DELETE FROM watch_progress WHERE video_id IN \(\?,\?,\?\)/);
    expect(calls[0].params).toEqual(['a', 'b', 'c']);
  });
});
