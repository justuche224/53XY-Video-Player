import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

/**
 * Shows up to 4 of a group's thumbnails as a collage (VLC-style) so a grouped
 * show reads as a collection at a glance. A single-video group falls back to one
 * thumbnail. Each cell reuses VideoThumbnail's lazy, cached loading.
 */
export function ThumbnailCollage({
  videos,
  style,
}: {
  videos: LibraryVideo[];
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const items = videos.slice(0, 4);

  if (items.length <= 1) {
    return <VideoThumbnail video={items[0]} style={style} />;
  }

  const cell = items.length === 2 ? styles.halfTall : styles.half;
  return (
    <View
      style={[
        { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceVariant ?? '#222' },
        styles.grid,
        style,
      ]}>
      {items.map((v) => (
        <VideoThumbnail key={v.id} video={v} style={cell} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '50%', height: '50%', borderRadius: 0 },
  halfTall: { width: '50%', height: '100%', borderRadius: 0 },
});
