import type { Migration } from './migrate';

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY NOT NULL,
        uri TEXT NOT NULL,
        filename TEXT NOT NULL,
        duration_ms INTEGER,
        size_bytes INTEGER,
        width INTEGER,
        height INTEGER,
        folder TEXT,
        modified_at INTEGER,
        created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS watch_progress (
        video_id TEXT PRIMARY KEY NOT NULL,
        position_ms INTEGER NOT NULL DEFAULT 0,
        percent REAL NOT NULL DEFAULT 0,
        completed INTEGER NOT NULL DEFAULT 0,
        last_played_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    up: `ALTER TABLE videos ADD COLUMN thumb_uri TEXT;`,
  },
  {
    version: 3,
    up: `CREATE INDEX IF NOT EXISTS idx_watch_progress_last_played
         ON watch_progress(last_played_at);`,
  },
];

export const LATEST_VERSION = 3;
