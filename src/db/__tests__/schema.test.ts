import { MIGRATIONS, LATEST_VERSION } from '../schema';

describe('schema migrations', () => {
  it('LATEST_VERSION matches the highest migration version', () => {
    const max = Math.max(...MIGRATIONS.map((m) => m.version));
    expect(LATEST_VERSION).toBe(max);
  });

  it('has a v3 migration that indexes watch_progress.last_played_at', () => {
    const v3 = MIGRATIONS.find((m) => m.version === 3);
    expect(v3).toBeDefined();
    expect(v3!.up).toMatch(/CREATE INDEX IF NOT EXISTS idx_watch_progress_last_played/);
    expect(v3!.up).toMatch(/watch_progress\s*\(\s*last_played_at\s*\)/);
  });

  it('migration 5 adds display_mode to watch_progress', () => {
    const m5 = MIGRATIONS.find((m) => m.version === 5);
    expect(m5).toBeDefined();
    expect(m5!.up).toContain('ALTER TABLE watch_progress ADD COLUMN display_mode TEXT');
  });

  it('migration 6 creates preview_frames keyed by (video_id, idx)', () => {
    const m6 = MIGRATIONS.find((m) => m.version === 6);
    expect(m6).toBeDefined();
    expect(m6!.up).toContain('CREATE TABLE IF NOT EXISTS preview_frames');
    expect(m6!.up).toMatch(/PRIMARY KEY \(video_id, idx\)/);
  });

  it('migration 7 adds thumbnail columns and drops existing thumbnails', () => {
    const m7 = MIGRATIONS.find((m) => m.version === 7);
    expect(m7).toBeDefined();
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_version INTEGER NOT NULL DEFAULT 0');
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_attempts INTEGER NOT NULL DEFAULT 0');
    expect(m7!.up).toContain('ALTER TABLE videos ADD COLUMN thumb_time_ms INTEGER');
    expect(m7!.up).toContain('UPDATE videos SET thumb_uri = NULL');
  });

  it('migration 8 creates manual_groups keyed by video_id', () => {
    const m8 = MIGRATIONS.find((m) => m.version === 8);
    expect(m8).toBeDefined();
    expect(m8!.up).toContain('CREATE TABLE IF NOT EXISTS manual_groups');
    expect(m8!.up).toMatch(/video_id TEXT PRIMARY KEY/);
  });

  // The completed column has existed since v1 but was overwritten on every
  // progress write, so anything re-opened after finishing lost the flag.
  // Percent still records the last session, so it reconstructs the flag once.
  it('migration 9 backfills the watched flag from percent', () => {
    const m9 = MIGRATIONS.find((m) => m.version === 9);
    expect(m9).toBeDefined();
    expect(m9!.up).toMatch(/UPDATE watch_progress SET completed = 1 WHERE percent >= 0\.95/);
    expect(LATEST_VERSION).toBe(9);
  });
});
