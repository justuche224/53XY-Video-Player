import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { Screen } from '@/components/screen';
import { PlaylistItemRow } from '@/components/playlist-item-row';
import { PressableScale } from '@/components/pressable-scale';
import {
  deletePlaylist,
  getAllPlaylists,
  getPlaylistItems,
  removeItem,
  renamePlaylist,
  reorderItems,
  type PlaylistRow as PlaylistRowType,
} from '@/db/playlists-repo';
import { getProgressMap, type ProgressMap } from '@/db/progress-repo';
import { useLibraryData } from '@/library/library-provider';
import type { LibraryVideo } from '@/library/types';
import { isCompleted } from '@/db/progress';
import { pickStart } from '@/playlists/pick-start';
import { resolvePlaylistItems } from '@/playlists/resolve-items';
import { useTheme } from '@/theme/theme-provider';

export default function PlaylistScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, spacing, radius } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { videos } = useLibraryData();
  const videosById = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);

  const [playlist, setPlaylist] = useState<PlaylistRowType | null>(null);
  const [items, setItems] = useState<LibraryVideo[]>([]);
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const [loading, setLoading] = useState(true);

  // Modal for rename
  const [renameVisible, setRenameVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const loadData = useCallback(async () => {
    if (!id) return;
    const all = await getAllPlaylists(db);
    const p = all.find((x) => x.id === id);
    if (!p) {
      router.back();
      return;
    }
    setPlaylist(p);

    const rawItems = await getPlaylistItems(db, id);
    const resolved = resolvePlaylistItems(rawItems, videosById);
    setItems(resolved);

    const pMap = await getProgressMap(db);
    setProgress(pMap);
    setLoading(false);
  }, [db, id, videosById, router]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handlePlayAll = () => {
    if (items.length === 0) return;
    const completedIds = new Set<string>();
    for (const v of items) {
      const p = progress.get(v.id);
      if (p && isCompleted(p.percent)) completedIds.add(v.id);
    }
    const start = pickStart(items, completedIds);
    if (!start) return;

    router.push({
      pathname: '/player',
      params: { videoId: start.id, uri: start.uri, title: start.filename, playlistId: id },
    } as any);
  };

  const handleRename = async () => {
    const name = newName.trim();
    if (!name || !id) return;
    await renamePlaylist(db, id, name);
    setRenameVisible(false);
    loadData();
  };

  const handleDelete = () => {
    if (!playlist) return;
    Alert.alert('Delete Playlist', `Are you sure you want to delete "${playlist.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!id) return;
          await deletePlaylist(db, id);
          router.back();
        },
      },
    ]);
  };

  const handleRemoveItem = async (videoId: string) => {
    if (!id) return;
    await removeItem(db, id, videoId);
    loadData();
  };

  const moveItem = async (index: number, direction: -1 | 1) => {
    if (!id) return;
    const newItems = [...items];
    const target = index + direction;
    if (target < 0 || target >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[target];
    newItems[target] = temp;

    setItems(newItems); // Optimistic UI
    await reorderItems(
      db,
      id,
      newItems.map((v) => v.id),
    );
    loadData();
  };

  if (loading || !playlist) return null;

  return (
    <Screen style={{ paddingHorizontal: spacing.lg }}>
      <AppBar
        title={playlist.name}
        variant="detail"
        onBack={() => router.back()}
        right={
          <>
            <PressableScale onPress={handlePlayAll} style={{ padding: 4, opacity: items.length ? 1 : 0.3 }} disabled={!items.length}>
              <Ionicons name="play" size={24} color={colors.primary} />
            </PressableScale>
            <PressableScale onPress={() => { setNewName(playlist.name); setRenameVisible(true); }} style={{ padding: 4 }}>
              <MaterialIcons name="edit" size={24} color={colors.onSurface} />
            </PressableScale>
            <PressableScale onPress={handleDelete} style={{ padding: 4 }}>
              <Ionicons name="trash-outline" size={24} color={colors.error ?? '#ef4444'} />
            </PressableScale>
          </>
        }
      />

      <FlashList
        data={items}
        keyExtractor={(v) => v.id}
        renderItem={({ item, index }) => (
          <PlaylistItemRow
            video={item}
            percent={progress.get(item.id)?.percent ?? 0}
            onPress={() =>
              router.push({
                pathname: '/player',
                params: { videoId: item.id, uri: item.uri, title: item.filename, playlistId: id },
              } as any)
            }
            onMoveUp={() => moveItem(index, -1)}
            onMoveDown={() => moveItem(index, 1)}
            onRemove={() => handleRemoveItem(item.id)}
            canMoveUp={index > 0}
            canMoveDown={index < items.length - 1}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: spacing.lg, alignItems: 'center' }}>
            <PressableScale
              onPress={() => router.push({ pathname: '/add-to-playlist', params: { playlistId: id } } as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: colors.primaryContainer ?? '#333',
                paddingVertical: 12,
                paddingHorizontal: 24,
                borderRadius: radius.pill,
              }}>
              <Ionicons name="add" size={20} color={colors.onPrimaryContainer ?? colors.primary} />
              <Text style={{ color: colors.onPrimaryContainer ?? colors.primary, fontWeight: '600' }}>Add Videos</Text>
            </PressableScale>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="list-outline" size={64} color={colors.surfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No videos yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8 }}>
              Add some videos to get started
            </Text>
          </View>
        }
      />

      <Modal transparent visible={renameVisible} animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
              Rename Playlist
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.onSurface,
                  borderColor: colors.surfaceVariant,
                  borderWidth: 1,
                  borderRadius: radius.md,
                },
              ]}
              placeholder="Enter a new name"
              placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <PressableScale onPress={() => setRenameVisible(false)} style={{ padding: 12 }}>
                <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontWeight: '600' }}>Cancel</Text>
              </PressableScale>
              <PressableScale onPress={handleRename} style={{ padding: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Rename</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    padding: 20,
    elevation: 4,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
