import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const HistoryRow = memo(function HistoryRow({
  video,
  percent,
  onPress,
  onRemove,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { colors, icon } = useTheme();
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
        meta={video.folder}
        percent={percent}
        durationMs={video.durationMs}
        onPress={onPress}
      />
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  fill: { width: '100%', height: '100%' },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
});
