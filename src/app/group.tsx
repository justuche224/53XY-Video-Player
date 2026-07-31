// src/app/group.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { EpisodeRow } from '@/components/episode-row';
import { GroupHero } from '@/components/group-hero';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { getHistory } from '@/db/history-repo';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { resolveLastPlayed } from '@/player/resume-last';
import { useGroups } from '@/library/use-groups';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export default function GroupDetailScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key, mode } = useLocalSearchParams<{ key: string; mode: 'name' | 'folder' }>();
  const { groups, loading } = useGroups(mode === 'folder' ? 'folder' : 'name');
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [resume, setResume] = useState<LibraryVideo | null>(null);

  const group = useMemo(() => groups.find((g) => g.key === key), [groups, key]);

  // Refetch on focus so progress + the Continue target update after returning
  // from the player. resolveLastPlayed scoped to this group's items gives "most
  // recently played episode of this show" for free.
  useFocusEffect(
    useCallback(() => {
      getProgressMap(db).then(setProgress);
      if (!group) return;
      const byId = new Map(group.items.map((v) => [v.id, v]));
      getHistory(db).then((rows) => setResume(resolveLastPlayed(rows, byId)));
    }, [db, group]),
  );

  const openVideo = useCallback(
    (video: LibraryVideo) => {
      router.push({
        pathname: '/player',
        params: { videoId: video.id, uri: video.uri, title: video.filename, groupKey: key, mode },
      });
    },
    [router, key, mode],
  );

  return (
    <Screen edges={['left', 'right']}>
      <FlashList
        data={group?.items ?? []}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <EpisodeRow
            video={item}
            percent={progress.get(item.id)?.percent ?? 0}
            onPress={() => openVideo(item)}
          />
        )}
        ListHeaderComponent={
          group ? (
            <View style={[styles.bleed, { marginHorizontal: -spacing.lg, marginBottom: spacing.md }]}>
              <GroupHero group={group} resume={resume} onContinue={openVideo} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2, gap: spacing.sm }}>
              <Ionicons name="film-outline" size={56} color={colors.surfaceVariant ?? '#444'} />
              <AppText variant="headline">No videos in this group</AppText>
            </View>
          )
        }
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl + insets.bottom }}
        bounces={true}
        overScrollMode="always"
      />

      {/* Floating back button: an artwork chip reads on both the banner and the
          page, so it needs no scroll-state plumbing. */}
      <View style={[styles.back, { top: insets.top + spacing.sm, left: spacing.lg }]}>
        <IconButton name="arrow-back" tone="artwork" onPress={() => router.back()} accessibilityLabel="Go back" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bleed: { overflow: 'hidden' },
  back: { position: 'absolute', zIndex: 10 },
});
