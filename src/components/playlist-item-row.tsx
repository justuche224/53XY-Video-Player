import { Pressable, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function PlaylistItemRow({
  video,
  percent,
  onPress,
  onMoveUp,
  onMoveDown,
  onRemove,
  canMoveUp,
  canMoveDown,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const { colors, icon } = useTheme();
  const handle = (
    <View style={styles.reorder}>
      <Pressable onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6} style={{ opacity: canMoveUp ? 1 : 0.25 }}>
        <Ionicons name="chevron-up" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
      </Pressable>
      <Pressable onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6} style={{ opacity: canMoveDown ? 1 : 0.25 }}>
        <Ionicons name="chevron-down" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />
      </Pressable>
    </View>
  );
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable onPress={onRemove} style={[styles.remove, { backgroundColor: colors.error ?? '#B00020' }]}>
          <Ionicons name="trash-outline" size={icon.md} color={colors.onError ?? '#fff'} />
        </Pressable>
      )}
    >
      <MediaRow
        thumbnail={<VideoThumbnail video={video} style={styles.fill} />}
        title={video.filename}
        percent={percent}
        durationMs={video.durationMs}
        onPress={onPress}
        trailing={handle}
      />
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  reorder: { alignItems: 'center', justifyContent: 'center' },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
});
