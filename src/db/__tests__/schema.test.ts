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
    expect(LATEST_VERSION).toBe(6);
  });
});
