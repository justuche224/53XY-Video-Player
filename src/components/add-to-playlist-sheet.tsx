import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { getAllPlaylists, createPlaylist, addItems, type PlaylistRow } from '@/db/playlists-repo';
import { useTheme } from '@/theme/theme-provider';

export function AddToPlaylistSheet({
  videoIds,
  visible,
  onClose,
}: {
  videoIds: string[];
  visible: boolean;
  onClose: () => void;
}) {
  const db = useSQLiteContext();
  const { colors, radius, spacing } = useTheme();
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const loadPlaylists = useCallback(async () => {
    const list = await getAllPlaylists(db);
    setPlaylists(list);
  }, [db]);

  useEffect(() => {
    if (visible) {
      loadPlaylists();
      setCreating(false);
      setNewName('');
    }
  }, [visible, loadPlaylists]);

  const handleSelect = async (playlistId: string) => {
    await addItems(db, playlistId, videoIds);
    onClose();
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const p = await createPlaylist(db, name);
    await addItems(db, p.id, videoIds);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1b1b1b',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
              maxHeight: '80%',
            },
          ]}
          onPress={() => {}}>
          <View style={styles.header}>
            <AppText variant="headline" style={{ flex: 1 }}>Add to Playlist</AppText>
            {creating ? (
              <IconButton name="close" accessibilityLabel="Cancel new playlist" onPress={() => setCreating(false)} />
            ) : (
              <IconButton name="add" accessibilityLabel="Create new playlist" onPress={() => setCreating(true)} />
            )}
          </View>

          {creating ? (
            <View style={{ gap: spacing.md, marginTop: spacing.md }}>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.onSurface, borderColor: colors.outline },
                ]}
                placeholder="New playlist name..."
                placeholderTextColor={colors.onSurfaceVariant}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                onSubmitEditing={handleCreate}
              />
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleCreate}>
                <AppText variant="body" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                  Create & Add
                </AppText>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              style={{ marginTop: spacing.md }}
              ListEmptyComponent={
                <AppText variant="body" style={{ color: colors.onSurfaceVariant, textAlign: 'center', marginTop: spacing.xl }}>
                  No playlists yet. Create one to get started!
                </AppText>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? colors.surfaceVariant : 'transparent' },
                  ]}
                  onPress={() => handleSelect(item.id)}>
                  <View style={{ flex: 1, paddingVertical: spacing.md }}>
                    <AppText variant="title">{item.name}</AppText>
                    <AppText variant="body" style={{ color: colors.onSurfaceVariant }}>
                      {item.itemCount} item{item.itemCount === 1 ? '' : 's'}
                    </AppText>
                  </View>
                  <IconButton
                    name="add-circle-outline"
                    accessibilityLabel={`Add to ${item.name}`}
                    onPress={() => handleSelect(item.id)}
                  />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginHorizontal: -16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
});
