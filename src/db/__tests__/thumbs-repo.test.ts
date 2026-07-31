import {
  getThumbState,
  getThumbStates,
  recordThumbFailure,
  setThumbResult,
} from '../thumbs-repo';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = [], first: unknown = null) {
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
    async getFirstAsync<T>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return first as T;
    },
  };
  return { db: db as never, calls };
}

describe('thumbs-repo', () => {
  it('getThumbStates maps every row into a state keyed by video id', async () => {
    const { db } = fakeDb([
      { id: 'a', thumb_uri: 'file:///a.jpg', thumb_version: 1, thumb_attempts: 0, thumb_time_ms: 900_000 },
      { id: 'b', thumb_uri: null, thumb_version: 0, thumb_attempts: 2, thumb_time_ms: null },
    ]);
    const states = await getThumbStates(db);
    expect(states.get('a')).toEqual({ uri: 'file:///a.jpg', version: 1, attempts: 0, timeMs: 900_000 });
    expect(states.get('b')).toEqual({ uri: null, version: 0, attempts: 2, timeMs: null });
  });

  it('getThumbState returns undefined for a missing row', async () => {
    const { db } = fakeDb([], null);
    expect(await getThumbState(db, 'nope')).toBeUndefined();
  });

  it('getThumbState maps a found row', async () => {
    const { db, calls } = fakeDb([], {
      thumb_uri: 'file:///x.jpg',
      thumb_version: 1,
      thumb_attempts: 0,
      thumb_time_ms: 1234,
    });
    expect(await getThumbState(db, 'x')).toEqual({
      uri: 'file:///x.jpg',
      version: 1,
      attempts: 0,
      timeMs: 1234,
    });
    expect(calls[0].params).toEqual(['x']);
  });

  it('setThumbResult stores uri, position and version and clears attempts', async () => {
    const { db, calls } = fakeDb();
    await setThumbResult(db, 'a', 'file:///a.jpg', 900_000, 1);
    expect(calls[0].sql).toMatch(/UPDATE videos/);
    expect(calls[0].sql).toMatch(/thumb_attempts = 0/);
    expect(calls[0].params).toEqual(['file:///a.jpg', 900_000, 1, 'a']);
  });

  it('recordThumbFailure restarts the attempt count when the version changed', async () => {
    const { db, calls } = fakeDb();
    await recordThumbFailure(db, 'a', 2);
    expect(calls[0].sql).toMatch(/thumb_attempts = CASE WHEN thumb_version = \? THEN thumb_attempts \+ 1 ELSE 1 END/);
    expect(calls[0].params).toEqual([2, 2, 'a']);
  });
});
