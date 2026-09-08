import {
  deleteMoment,
  deleteMoments,
  getMoments,
  getMomentsForVideo,
  insertMoment,
  replaceAllMoments,
  updateMomentNote,
  updateMomentVideoLink,
} from '../moments-repo';
import type { Moment } from '@/moments/types';

type Call = { sql: string; params?: unknown[] };

function fakeDb(rows: unknown[] = []) {
  const calls: Call[] = [];
  const db = {
    async runAsync(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return undefined as never;
    },
    async getAllAsync<T>(sql: string, params?: unknown[]) {
      calls.push({ sql, params });
      return rows as T[];
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      await fn();
    },
  };
  return { db: db as never, calls };
}

const sample: Moment = {
  id: 'm1',
  videoId: 'v1',
  positionMs: 2_472_000,
  createdAt: 1_757_000_000_000,
  frameUri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episodeLabel: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  videoUri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  durationMs: 2_580_000,
};

const dbRow = {
  id: 'm1',
  video_id: 'v1',
  position_ms: 2_472_000,
  created_at: 1_757_000_000_000,
  frame_uri: 'file:///storage/emulated/0/53XY/Moments/m1.jpg',
  note: 'Denny gets the case',
  title: 'Boston Legal',
  episode_label: 'S02E14',
  filename: 'Boston.Legal.S02E14.mkv',
  folder: 'Movies/Boston Legal',
  video_uri: 'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
  duration_ms: 2_580_000,
};

describe('moments-repo', () => {
  it('insertMoment writes every snapshot column', async () => {
    const { db, calls } = fakeDb();
    await insertMoment(db, sample);
    expect(calls[0].sql).toContain('INSERT INTO moments');
    expect(calls[0].params).toEqual([
      'm1',
      'v1',
      2_472_000,
      1_757_000_000_000,
      'file:///storage/emulated/0/53XY/Moments/m1.jpg',
      'Denny gets the case',
      'Boston Legal',
      'S02E14',
      'Boston.Legal.S02E14.mkv',
      'Movies/Boston Legal',
      'file:///storage/emulated/0/Movies/Boston.Legal.S02E14.mkv',
      2_580_000,
    ]);
  });

  it('getMoments maps rows back and orders newest first', async () => {
    const { db, calls } = fakeDb([dbRow]);
    const moments = await getMoments(db);
    expect(moments).toEqual([sample]);
    expect(calls[0].sql).toContain('ORDER BY created_at DESC');
  });

  it('maps a frameless moment without inventing a uri', async () => {
    const { db } = fakeDb([{ ...dbRow, frame_uri: null, note: null, episode_label: null }]);
    const [moment] = await getMoments(db);
    expect(moment.frameUri).toBeNull();
    expect(moment.note).toBeNull();
    expect(moment.episodeLabel).toBeNull();
  });

  it('getMomentsForVideo filters by video and orders by position', async () => {
    const { db, calls } = fakeDb([dbRow]);
    await getMomentsForVideo(db, 'v1');
    expect(calls[0].sql).toContain('WHERE video_id = ?');
    expect(calls[0].sql).toContain('ORDER BY position_ms');
    expect(calls[0].params).toEqual(['v1']);
  });

  it('updateMomentNote writes the note for one id', async () => {
    const { db, calls } = fakeDb();
    await updateMomentNote(db, 'm1', 'new note');
    expect(calls[0].sql).toContain('UPDATE moments');
    expect(calls[0].params).toEqual(['new note', 'm1']);
  });

  it('deleteMoment removes one row', async () => {
    const { db, calls } = fakeDb();
    await deleteMoment(db, 'm1');
    expect(calls[0].sql).toContain('DELETE FROM moments WHERE id = ?');
    expect(calls[0].params).toEqual(['m1']);
  });

  it('replaceAllMoments clears the table before inserting', async () => {
    const { db, calls } = fakeDb();
    await replaceAllMoments(db, [sample]);
    expect(calls[0].sql).toContain('DELETE FROM moments');
    expect(calls[1].sql).toContain('INSERT INTO moments');
  });

  it('updateMomentVideoLink heals both the id and the uri', async () => {
    const { db, calls } = fakeDb();
    await updateMomentVideoLink(db, 'm1', 'v99', 'file:///new/path.mkv');
    expect(calls[0].sql).toContain('UPDATE moments');
    expect(calls[0].sql).toContain('video_id = ?');
    expect(calls[0].sql).toContain('video_uri = ?');
    expect(calls[0].params).toEqual(['v99', 'file:///new/path.mkv', 'm1']);
  });

  it('deleteMoments removes every id in one statement', async () => {
    const { db, calls } = fakeDb();
    await deleteMoments(db, ['m1', 'm2', 'm3']);
    expect(calls[0].sql).toContain('DELETE FROM moments WHERE id IN (?,?,?)');
    expect(calls[0].params).toEqual(['m1', 'm2', 'm3']);
  });

  it('deleteMoments does nothing for an empty list', async () => {
    // An empty IN () is a SQL syntax error, so this must short-circuit.
    const { db, calls } = fakeDb();
    await deleteMoments(db, []);
    expect(calls).toEqual([]);
  });
});
