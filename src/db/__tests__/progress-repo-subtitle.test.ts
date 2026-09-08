import { getSubtitlePrefs, setSubtitlePrefs, setSubtitleDelay, upsertProgress, getEmbeddedSubtitleId, setEmbeddedSubtitleId } from '../progress-repo';
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

describe('getSubtitlePrefs', () => {
  it('returns the stored uri and delay', async () => {
    const { db, setFirstResult } = makeFakeDb();
    setFirstResult({ subtitle_uri: 'file:///a/b.srt', subtitle_delay_ms: 250 });
    expect(await getSubtitlePrefs(db, 'v1')).toEqual({ uri: 'file:///a/b.srt', delayMs: 250 });
  });

  it('defaults to no subtitle and zero delay when there is no row', async () => {
    const { db } = makeFakeDb();
    expect(await getSubtitlePrefs(db, 'v1')).toEqual({ uri: null, delayMs: 0 });
  });
});

describe('setSubtitlePrefs', () => {
  it('upserts both columns with defaults for a missing row', async () => {
    const { db, calls } = makeFakeDb();
    await setSubtitlePrefs(db, 'v1', 'file:///a/b.srt', -500, 123);
    expect(calls[0].sql).toContain('INSERT INTO watch_progress');
    expect(calls[0].sql).toContain('subtitle_uri = excluded.subtitle_uri');
    expect(calls[0].sql).toContain('subtitle_delay_ms = excluded.subtitle_delay_ms');
    expect(calls[0].params).toEqual(['v1', 123, 'file:///a/b.srt', -500]);
  });

  it('writes NULL to clear the subtitle', async () => {
    const { db, calls } = makeFakeDb();
    await setSubtitlePrefs(db, 'v1', null, 0, 123);
    expect(calls[0].params).toEqual(['v1', 123, null, 0]);
  });
});

describe('setSubtitleDelay', () => {
  it('writes only subtitle_delay_ms, never subtitle_uri', async () => {
    const { db, calls } = makeFakeDb();
    await setSubtitleDelay(db, 'v1', 250, 123);
    expect(calls[0].sql).toContain('INSERT INTO watch_progress');
    expect(calls[0].sql).toContain('subtitle_delay_ms = excluded.subtitle_delay_ms');
    expect(calls[0].sql).not.toContain('subtitle_uri');
    expect(calls[0].params).toEqual(['v1', 123, 250]);
  });
});

describe('getEmbeddedSubtitleId', () => {
  it('returns the stored id when a row exists', async () => {
    const { db, setFirstResult } = makeFakeDb();
    setFirstResult({ embedded_subtitle_id: 'sub-track-2' });
    expect(await getEmbeddedSubtitleId(db, 'v1')).toBe('sub-track-2');
  });

  it('returns null when there is no row', async () => {
    const { db } = makeFakeDb();
    expect(await getEmbeddedSubtitleId(db, 'v1')).toBeNull();
  });

  it('returns null when the column is explicitly null', async () => {
    const { db, setFirstResult } = makeFakeDb();
    setFirstResult({ embedded_subtitle_id: null });
    expect(await getEmbeddedSubtitleId(db, 'v1')).toBeNull();
  });
});

describe('setEmbeddedSubtitleId', () => {
  it('upserts only embedded_subtitle_id, never subtitle columns', async () => {
    const { db, calls } = makeFakeDb();
    await setEmbeddedSubtitleId(db, 'v1', 'sub-track-2', 123);
    expect(calls[0].sql).toContain('INSERT INTO watch_progress');
    expect(calls[0].sql).toContain('embedded_subtitle_id = excluded.embedded_subtitle_id');
    expect(calls[0].sql).not.toContain('subtitle_uri');
    expect(calls[0].sql).not.toContain('subtitle_delay_ms');
    expect(calls[0].params).toEqual(['v1', 123, 'sub-track-2']);
  });

  it('writes NULL to clear the embedded subtitle selection', async () => {
    const { db, calls } = makeFakeDb();
    await setEmbeddedSubtitleId(db, 'v1', null, 123);
    expect(calls[0].params).toEqual(['v1', 123, null]);
  });
});

// Migration v9 exists because `completed` was being clobbered by
// excluded.completed on every progress write. The subtitle columns must
// never join that SET list, or the same class of bug returns.
describe('upsertProgress', () => {
  it('never touches the subtitle or embedded subtitle columns', async () => {
    const { db, calls } = makeFakeDb();
    await upsertProgress(db, 'v1', {
      positionMs: 1000,
      percent: 0.5,
      completed: false,
      lastPlayedAt: 123,
    });
    expect(calls[0].sql).not.toContain('subtitle_uri');
    expect(calls[0].sql).not.toContain('subtitle_delay_ms');
    expect(calls[0].sql).not.toContain('embedded_subtitle_id');
  });
});
