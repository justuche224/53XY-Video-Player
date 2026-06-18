// src/app/group.tsx
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Text } from 'react-native';

import { EpisodeRow } from '@/components/episode-row';
import { Screen } from '@/components/screen';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { useGroups } from '@/library/use-groups';
import { useTheme } from '@/theme/theme-provider';

export default function GroupDetailScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { key, mode } = useLocalSearchParams<{ key: string; mode: 'name' | 'folder' }>();
  const { groups } = useGroups(mode === 'folder' ? 'folder' : 'name');
  const [progress, setProgress] = useState<ProgressMap>(new Map());

  // Refetch on focus so progress updates after returning from the player.
  useFocusEffect(
    useCallback(() => {
      getProgressMap(db).then(setProgress);
    }, [db]),
  );

  const group = useMemo(() => groups.find((g) => g.key === key), [groups, key]);

  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: group?.title ?? 'Group' }} />
      <FlatList
        data={group?.items ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <EpisodeRow
            video={item}
            percent={progress.get(item.id)?.percent ?? 0}
            onPress={() => router.push({ pathname: '/player', params: { videoId: item.id, uri: item.uri, title: item.filename, groupKey: key, mode } })}
          />
        )}
        ListEmptyComponent={<Text style={{ color: colors.onSurface }}>Loading…</Text>}
      />
    </Screen>
  );
}
