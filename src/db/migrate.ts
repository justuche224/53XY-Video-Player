export interface MigrationDb {
  execAsync(source: string): Promise<unknown>;
  getFirstAsync<T>(source: string): Promise<T | null>;
}

export interface Migration {
  version: number;
  up: string;
}

export async function runMigrations(
  db: MigrationDb,
  migrations: Migration[],
): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  const pending = migrations
    .filter((m) => m.version > current)
    .sort((a, b) => a.version - b.version);
  for (const m of pending) {
    await db.execAsync(m.up);
    await db.execAsync(`PRAGMA user_version = ${m.version}`);
  }
  return pending.length ? pending[pending.length - 1].version : current;
}
