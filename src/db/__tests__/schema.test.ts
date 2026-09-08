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
  });

  it('migration 10 adds subtitle columns to watch_progress', () => {
    const m10 = MIGRATIONS.find((m) => m.version === 10);
    expect(m10).toBeDefined();
    expect(m10!.up).toContain('ALTER TABLE watch_progress ADD COLUMN subtitle_uri TEXT');
    expect(m10!.up).toContain(
      'ALTER TABLE watch_progress ADD COLUMN subtitle_delay_ms INTEGER NOT NULL DEFAULT 0',
    );
  });

  it('migration 11 creates moments with no foreign key to videos', () => {
    const m11 = MIGRATIONS.find((m) => m.version === 11);
    expect(m11).toBeDefined();
    expect(m11!.up).toContain('CREATE TABLE IF NOT EXISTS moments');
    // \s+ rather than the literal run of spaces: the migration aligns its
    // column types for readability, and a test that breaks when someone
    // re-aligns them is testing whitespace, not schema.
    expect(m11!.up).toMatch(/position_ms\s+INTEGER NOT NULL/);
    expect(m11!.up).toMatch(/title\s+TEXT NOT NULL/);
    // The whole point of the feature: a scan removing the video row must not
    // cascade the user's saved moments away.
    expect(m11!.up).not.toMatch(/REFERENCES\s+videos/i);
    expect(m11!.up).not.toMatch(/ON DELETE CASCADE/i);
  });

  it('migration 11 indexes moments for the tab and for per-video lookup', () => {
    const m11 = MIGRATIONS.find((m) => m.version === 11);
    expect(m11!.up).toContain('CREATE INDEX IF NOT EXISTS idx_moments_created');
    expect(m11!.up).toContain('CREATE INDEX IF NOT EXISTS idx_moments_video');
  });
});
