import type { SQLiteDatabase } from 'expo-sqlite';

export type ManualGroupsMap = Map<string, string>; // video_id -> group_name

export async function getManualGroupsMap(db: SQLiteDatabase): Promise<ManualGroupsMap> {
  const rows = await db.getAllAsync<{ video_id: string; group_name: string }>(
    'SELECT video_id, group_name FROM manual_groups'
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    map.set(r.video_id, r.group_name);
  }
  return map;
}

export async function setManualGroup(
  db: SQLiteDatabase,
  videoIds: string[],
  groupName: string | null
): Promise<void> {
  if (videoIds.length === 0) return;

  await db.withTransactionAsync(async () => {
    if (groupName === null) {
      // Remove overrides
      const placeholders = videoIds.map(() => '?').join(',');
      await db.runAsync(`DELETE FROM manual_groups WHERE video_id IN (${placeholders})`, videoIds);
    } else {
      // Upsert overrides
      for (const id of videoIds) {
        await db.runAsync(
          `INSERT INTO manual_groups (video_id, group_name) VALUES (?, ?)
           ON CONFLICT(video_id) DO UPDATE SET group_name = excluded.group_name`,
          [id, groupName]
        );
      }
    }
  });
}
