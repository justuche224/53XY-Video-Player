// src/app/group.tsx
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { ContextualAppBar } from '@/components/contextual-app-bar';
import { EpisodeRow } from '@/components/episode-row';
import { GroupHero } from '@/components/group-hero';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { VideoInfoSheet } from '@/components/video-info-sheet';
import { AddToPlaylistSheet } from '@/components/add-to-playlist-sheet';
import { EditGroupSheet } from '@/components/edit-group-sheet';
import { getHistory } from '@/db/history-repo';
import { getProgressMap, setVideosPlayedState, type ProgressMap } from '@/db/progress-repo';
import { setManualGroup } from '@/db/manual-groups-repo';
import { resolveLastPlayed } from '@/player/resume-last';
import { useGroups } from '@/library/use-groups';
import { useLibraryData } from '@/library/library-provider';
import { deleteVideos, shareVideos } from '@/library/media-actions';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export default function GroupDetailScreen() {
  const { colors, spacing } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key, mode } = useLocalSearchParams<{ key: string; mode: 'name' | 'folder' }>();
  const { groups, loading } = useGroups(mode === 'folder' ? 'folder' : 'name');
  const { reload } = useLibraryData();
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [resume, setResume] = useState<LibraryVideo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [infoVideoId, setInfoVideoId] = useState<string | null>(null);
  const [playlistVideoIds, setPlaylistVideoIds] = useState<string[]>([]);
  const [ungroupVideoIds, setUngroupVideoIds] = useState<string[]>([]);

  const group = useMemo(() => groups.find((g) => g.key === key), [groups, key]);

  // Clear selection on back press
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedIds(new Set());
      return true; // prevent default
    });
    return () => backHandler.remove();
  }, [selectedIds]);

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
        renderItem={({ item }) => {
          const isSelectionMode = selectedIds.size > 0;
          const selected = selectedIds.has(item.id);

          const handlePress = () => {
            if (isSelectionMode) {
              const next = new Set(selectedIds);
              if (next.has(item.id)) next.delete(item.id);
              else next.add(item.id);
              setSelectedIds(next);
            } else {
              openVideo(item);
            }
          };

          const handleLongPress = () => {
            const next = new Set(selectedIds);
            if (next.has(item.id)) next.delete(item.id);
            else next.add(item.id);
            setSelectedIds(next);
          };

          return (
            <EpisodeRow
              video={item}
              percent={progress.get(item.id)?.percent ?? 0}
              onPress={handlePress}
              onLongPress={handleLongPress}
              selected={selected}
            />
          );
        }}
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
      {selectedIds.size === 0 ? (
        <View style={[styles.back, { top: insets.top + spacing.sm, left: spacing.lg }]}>
          <IconButton name="arrow-back" tone="artwork" onPress={() => router.back()} accessibilityLabel="Go back" />
        </View>
      ) : (
        <ContextualAppBar
          selectedCount={selectedIds.size}
          onClearSelection={() => setSelectedIds(new Set())}
          onPlay={() => {
            const selectedVideos = group?.items.filter(v => selectedIds.has(v.id)) ?? [];
            if (selectedVideos.length === 0) return;
            const first = selectedVideos[0];
            openVideo(first);
            setSelectedIds(new Set());
          }}
          onMarkPlayed={async () => {
            const ids = Array.from(selectedIds);
            await setVideosPlayedState(db, ids, true, Date.now());
            setSelectedIds(new Set());
            const newProgress = new Map(progress);
            for (const id of ids) {
              newProgress.set(id, { percent: 1, positionMs: 0 });
            }
            setProgress(newProgress);
          }}
          onMarkUnplayed={async () => {
            const ids = Array.from(selectedIds);
            await setVideosPlayedState(db, ids, false, Date.now());
            setSelectedIds(new Set());
            const newProgress = new Map(progress);
            for (const id of ids) {
              newProgress.delete(id);
            }
            setProgress(newProgress);
          }}
          onAddToPlaylist={() => {
            if (selectedIds.size > 0) {
              setPlaylistVideoIds(Array.from(selectedIds));
            }
          }}
          onUngroup={() => {
            if (selectedIds.size > 0) {
              setUngroupVideoIds(Array.from(selectedIds));
            }
          }}
          onShare={() => {
            const uris = group?.items.filter(v => selectedIds.has(v.id)).map(v => v.uri) ?? [];
            shareVideos(uris);
          }}
          onDelete={() => {
            const ids = Array.from(selectedIds);
            deleteVideos(ids, () => {
              setSelectedIds(new Set());
              reload();
            });
          }}
          onInfo={() => {
            if (selectedIds.size === 1) {
              setInfoVideoId(Array.from(selectedIds)[0]);
            }
          }}
        />
      )}

      <VideoInfoSheet
        video={group?.items.find(v => v.id === infoVideoId) ?? null}
        visible={infoVideoId !== null}
        onClose={() => setInfoVideoId(null)}
      />
      <AddToPlaylistSheet
        videoIds={playlistVideoIds}
        visible={playlistVideoIds.length > 0}
        onClose={() => {
          setPlaylistVideoIds([]);
          setSelectedIds(new Set());
        }}
      />
      <EditGroupSheet
        visible={ungroupVideoIds.length > 0}
        defaultName={group?.title}
        onClose={() => {
          setUngroupVideoIds([]);
          setSelectedIds(new Set());
        }}
        onSubmit={async (newName) => {
          await setManualGroup(db, ungroupVideoIds, newName);
          reload();
          // We don't automatically go back here, since they might just be moving one file
          // but if they moved the last file, the list will be empty and that's fine.
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bleed: { overflow: 'hidden' },
  back: { position: 'absolute', zIndex: 10 },
});
