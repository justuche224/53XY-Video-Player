import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
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
  const { colors, icon } = useTheme();
  return (
    <MediaRow
      thumbnail={<ThumbnailCollage videos={videos} style={styles.fill} />}
      title={playlist.name}
      titleLines={1}
      meta={`${playlist.itemCount} video${playlist.itemCount === 1 ? '' : 's'}`}
      onPress={onPress}
      onLongPress={onLongPress}
      trailing={<Ionicons name="chevron-forward" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />}
    />
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
