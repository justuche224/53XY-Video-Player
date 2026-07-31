import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

/**
 * Shows up to 4 of a group's thumbnails as a collage (VLC-style) so a grouped
 * show reads as a collection at a glance. A single-video group falls back to one
 * thumbnail. Each cell reuses VideoThumbnail's lazy, cached loading.
 *
 * Square by default, like VideoThumbnail: the poster container holding it owns
 * the corner radius, so the two can't drift out of sync.
 */
export function ThumbnailCollage({
  videos,
  style,
  radius = 0,
}: {
  videos: LibraryVideo[];
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  const { colors } = useTheme();
  const items = videos.slice(0, 4);
  const placeholder = colors.surfaceVariant ?? '#222';

  if (items.length === 0) {
    return <View style={[{ backgroundColor: placeholder, borderRadius: radius }, style]} />;
  }

  if (items.length === 1) {
    return <VideoThumbnail video={items[0]} style={style} radius={radius} />;
  }

  const cell = items.length === 2 ? styles.halfTall : styles.half;
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden', backgroundColor: placeholder },
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
  half: { width: '50%', height: '50%' },
  halfTall: { width: '50%', height: '100%' },
});
