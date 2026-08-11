import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppText } from './app-text';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number | null) {
  if (!ms) return 'Unknown';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function VideoInfoSheet({
  video,
  visible,
  onClose,
}: {
  video: LibraryVideo | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();

  if (!video) return null;

  // Attempt to fetch file size. We don't have it directly on LibraryVideo type
  // Wait, does LibraryVideo have size? Let's check types.ts
  // LibraryVideo only has durationMs, width, height, addedAt, modifiedAt.

  const renderRow = (label: string, value: string | number | null) => {
    if (value == null) return null;
    return (
      <View style={styles.row}>
        <AppText variant="body" style={{ color: colors.onSurfaceVariant, flex: 1 }}>{label}</AppText>
        <AppText variant="body" style={{ color: colors.onSurface, flex: 2 }}>{value}</AppText>
      </View>
    );
  };

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
              gap: spacing.sm,
            },
          ]}
          onPress={() => {}}>
          <AppText variant="headline" style={{ marginBottom: spacing.sm }}>Video Info</AppText>
          
          {renderRow('File', video.filename)}
          {renderRow('Folder', video.folder)}
          {renderRow('Duration', formatDuration(video.durationMs))}
          {renderRow('Resolution', video.width && video.height ? `${video.width} x ${video.height}` : null)}
          {renderRow('Path', video.uri)}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
