import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { SearchBar } from '@/components/search-bar';
import { VideoThumbnail } from '@/components/video-thumbnail';
import { PressableScale } from '@/components/pressable-scale';
import { getPlaylistItems, addItems, removeItem } from '@/db/playlists-repo';
import { useLibraryData } from '@/library/library-provider';
import { useFilterSettings } from '@/library/filter-settings';
import { applyFilters } from '@/library/filter-videos';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';
import type { LibraryVideo } from '@/library/types';

export default function AddToPlaylistScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, spacing, radius } = useTheme();
  const { playlistId } = useLocalSearchParams<{ playlistId: string }>();

  const { videos } = useLibraryData();
  const { filter } = useFilterSettings();

  const [query, setQuery] = useState('');
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!playlistId) return;
    getPlaylistItems(db, playlistId).then((rows) => {
      const ids = new Set(rows.map((r) => r.videoId));
      setExistingIds(ids);
      setSelectedIds(new Set(ids));
      setLoading(false);
    });
  }, [db, playlistId]);

  const visibleVideos = useMemo(() => {
    let filtered = applyFilters(videos, filter);
    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter((v) => v.filename.toLowerCase().includes(q));
    }
    return filtered;
  }, [videos, filter, query]);

  const toggleVideo = useCallback((videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }, []);

  const handleDone = async () => {
    if (!playlistId) return;

    const toAdd = Array.from(selectedIds).filter((id) => !existingIds.has(id));
    const toRemove = Array.from(existingIds).filter((id) => !selectedIds.has(id));

    if (toAdd.length > 0) {
      await addItems(db, playlistId, toAdd);
    }
    for (const id of toRemove) {
      await removeItem(db, playlistId, id);
    }
    router.back();
  };

  const addedCount = Array.from(selectedIds).filter((id) => !existingIds.has(id)).length;
  const removedCount = Array.from(existingIds).filter((id) => !selectedIds.has(id)).length;
  const hasChanges = addedCount > 0 || removedCount > 0;

  const doneLabel = hasChanges
    ? `Done (${addedCount ? `+${addedCount}` : ''}${addedCount && removedCount ? ' ' : ''}${
        removedCount ? `-${removedCount}` : ''
      })`
    : 'Done';

  const renderItem = useCallback(
    ({ item }: { item: LibraryVideo }) => {
      const isSelected = selectedIds.has(item.id);
      return (
        <PressableScale
          onPress={() => toggleVideo(item.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.sm,
            gap: spacing.md,
            borderRadius: radius.md,
          }}>
          <Ionicons
            name={isSelected ? 'checkbox' : 'square-outline'}
            size={24}
            color={isSelected ? colors.primary : colors.onSurfaceVariant ?? '#888'}
          />
          {/* Standalone (no clipping poster container), so it owns its corner. */}
          <VideoThumbnail video={item} style={styles.thumb} radius={radius.md} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>
              {item.filename}
            </Text>
            {item.durationMs ? (
              <Text style={{ color: colors.onSurfaceVariant ?? '#888', fontSize: 12, marginTop: 4 }}>
                {formatTime(item.durationMs)}
              </Text>
            ) : null}
          </View>
        </PressableScale>
      );
    },
    [colors, radius, selectedIds, spacing, toggleVideo],
  );

  if (loading) return null;

  return (
    <Screen style={{ paddingHorizontal: spacing.lg }}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <PressableScale onPress={() => router.back()} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
          </PressableScale>
          <Text style={[styles.titleText, { color: colors.onSurface }]}>Add to Playlist</Text>
        </View>
        <PressableScale onPress={handleDone} style={{ padding: 8 }}>
          <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>
            {doneLabel}
          </Text>
        </PressableScale>
      </View>

      <View style={{ marginBottom: spacing.sm }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <FlashList
        data={visibleVideos}
        keyExtractor={(v) => v.id}
        renderItem={renderItem}
        extraData={selectedIds}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="search-outline" size={64} color={colors.surfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No videos found
            </Text>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
  },
  thumb: {
    width: 96,
    height: 60,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
});
