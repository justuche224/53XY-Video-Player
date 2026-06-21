import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ThumbnailCollage } from './thumbnail-collage';
import type { PlaylistRow as PlaylistRowType } from '@/db/playlists-repo';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function PlaylistRow({
  playlist,
  videos,
  onPress,
  onLongPress,
}: {
  playlist: PlaylistRowType;
  videos: LibraryVideo[];
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.sm,
        gap: spacing.md,
        borderRadius: radius.md,
        overflow: 'hidden',
      }}>
      <ThumbnailCollage videos={videos} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>
          {playlist.name}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12 }}>
          {playlist.itemCount} video{playlist.itemCount === 1 ? '' : 's'}
        </Text>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 60 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
});
