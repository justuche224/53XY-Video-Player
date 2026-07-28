import { getDisplayMode, setDisplayMode } from '../progress-repo';
import type { SQLiteDatabase } from 'expo-sqlite';

function makeFakeDb() {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let firstResult: unknown = null;
  const db = {
    async runAsync(sql: string, params: unknown[]) {
      calls.push({ sql, params });
    },
    async getFirstAsync(sql: string, params: unknown[]) {
      calls.push({ sql, params });
      return firstResult;
    },
  } as unknown as SQLiteDatabase;
  return { db, calls, setFirstResult: (r: unknown) => (firstResult = r) };
}

describe('getDisplayMode', () => {
  it('returns the stored mode', async () => {
    const { db, setFirstResult } = makeFakeDb();
    setFirstResult({ display_mode: 'crop' });
    expect(await getDisplayMode(db, 'v1')).toBe('crop');
  });
  it('returns null when no row or no mode', async () => {
    const { db } = makeFakeDb();
    expect(await getDisplayMode(db, 'v1')).toBeNull();
  });
});

describe('setDisplayMode', () => {
  it('upserts the mode with defaults for a missing row', async () => {
    const { db, calls } = makeFakeDb();
    await setDisplayMode(db, 'v1', 'crop', 123);
    expect(calls[0].sql).toContain('INSERT INTO watch_progress');
    expect(calls[0].sql).toContain('display_mode = excluded.display_mode');
    expect(calls[0].params).toEqual(['v1', 123, 'crop']);
  });
  it('writes NULL to clear (fit)', async () => {
    const { db, calls } = makeFakeDb();
    await setDisplayMode(db, 'v1', null, 123);
    expect(calls[0].params).toEqual(['v1', 123, null]);
  });
});
