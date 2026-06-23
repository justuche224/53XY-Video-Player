import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState, useMemo } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
} from 'react-native';

import { Screen } from '@/components/screen';
import { TAB_BAR_CLEARANCE } from '@/components/floating-tab-bar';
import { PlaylistRow } from '@/components/playlist-row';
import { PressableScale } from '@/components/pressable-scale';
import {
  createPlaylist,
  deletePlaylist,
  getAllPlaylists,
  getPlaylistItems,
  type PlaylistRow as PlaylistRowType,
} from '@/db/playlists-repo';
import { useLibraryData } from '@/library/library-provider';
import type { LibraryVideo } from '@/library/types';
import { resolvePlaylistItems } from '@/playlists/resolve-items';
import { useTheme } from '@/theme/theme-provider';

export default function PlaylistsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, spacing, radius } = useTheme();
  const { videos } = useLibraryData();

  const [playlists, setPlaylists] = useState<PlaylistRowType[]>([]);
  const [playlistVideos, setPlaylistVideos] = useState<Map<string, LibraryVideo[]>>(new Map());

  // Modal state for Android-compatible prompt
  const [promptVisible, setPromptVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const videosById = useMemo(() => new Map(videos.map((v) => [v.id, v])), [videos]);

  const loadData = useCallback(async () => {
    const rows = await getAllPlaylists(db);
    setPlaylists(rows);

    const vMap = new Map<string, LibraryVideo[]>();
    for (const row of rows) {
      const items = await getPlaylistItems(db, row.id);
      const resolved = resolvePlaylistItems(items, videosById);
      vMap.set(row.id, resolved);
    }
    setPlaylistVideos(vMap);
  }, [db, videosById]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleCreate = async () => {
    const name = newPlaylistName.trim();
    if (!name) return;
    await createPlaylist(db, name);
    setNewPlaylistName('');
    setPromptVisible(false);
    loadData();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Playlist', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePlaylist(db, id);
          loadData();
        },
      },
    ]);
  };

  return (
    <Screen style={{ paddingHorizontal: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Playlists</Text>
        <PressableScale onPress={() => setPromptVisible(true)} style={{ padding: 4 }}>
          <Ionicons name="add-circle-outline" size={28} color={colors.onSurface} />
        </PressableScale>
      </View>

      <FlashList
        data={playlists}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <PlaylistRow
            playlist={item}
            videos={playlistVideos.get(item.id) ?? []}
            onPress={() => router.push({ pathname: '/playlist', params: { id: item.id } } as any)}
            onLongPress={() => handleDelete(item.id, item.name)}
          />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl * 2 }}>
            <Ionicons name="musical-notes-outline" size={64} color={colors.surfaceVariant ?? '#444'} />
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginTop: spacing.md }}>
              No playlists yet
            </Text>
            <Text style={{ color: colors.onSurfaceVariant ?? '#888', marginTop: 8 }}>
              Tap + to create one
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      />

      <Modal transparent visible={promptVisible} animationType="fade">
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: '600', marginBottom: 16 }}>
              New Playlist
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
              placeholder="Enter a name"
              placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <PressableScale onPress={() => setPromptVisible(false)} style={{ padding: 12 }}>
                <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontWeight: '600' }}>
                  Cancel
                </Text>
              </PressableScale>
              <PressableScale onPress={handleCreate} style={{ padding: 12 }}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Create</Text>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
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
