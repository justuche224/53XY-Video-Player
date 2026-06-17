import { runMigrations, type Migration, type MigrationDb } from '../migrate';

function makeFakeDb(startVersion = 0) {
  let version = startVersion;
  const executed: string[] = [];
  const db: MigrationDb = {
    async execAsync(source: string) {
      executed.push(source);
      const m = source.match(/PRAGMA user_version\s*=\s*(\d+)/);
      if (m) version = Number(m[1]);
      return undefined;
    },
    async getFirstAsync<T>(_source: string) {
      return { user_version: version } as unknown as T;
    },
  };
  return { db, executed, getVersion: () => version };
}

const MIGRATIONS: Migration[] = [
  { version: 1, up: 'CREATE TABLE a (id);' },
  { version: 2, up: 'CREATE TABLE b (id);' },
];

describe('runMigrations', () => {
  it('applies all pending migrations from a fresh db and returns latest version', async () => {
    const { db, executed, getVersion } = makeFakeDb(0);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(getVersion()).toBe(2);
    expect(executed).toContain('CREATE TABLE a (id);');
    expect(executed).toContain('CREATE TABLE b (id);');
  });

  it('skips already-applied migrations', async () => {
    const { db, executed } = makeFakeDb(1);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(executed).toContain('CREATE TABLE b (id);');
    expect(executed).not.toContain('CREATE TABLE a (id);');
  });

  it('is a no-op when already at latest', async () => {
    const { db, executed } = makeFakeDb(2);
    const result = await runMigrations(db, MIGRATIONS);
    expect(result).toBe(2);
    expect(executed).toEqual([]);
  });
});
