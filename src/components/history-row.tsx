import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
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
  const { colors, spacing, radius } = useTheme();
  return (
    <Swipeable
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          onPress={onRemove}
          style={[styles.remove, { backgroundColor: colors.error ?? '#B00020' }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.onError ?? '#fff'} />
        </Pressable>
      )}
    >
      <PressableScale
        onPress={onPress}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.sm,
          backgroundColor: colors.background,
          borderRadius: radius.md,
        }}
      >
        <View>
          <VideoThumbnail video={video} style={styles.thumb} />
          <DurationBadge ms={video.durationMs} />
          <View style={styles.progress}>
            <ProgressBar percent={percent} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>
            {video.filename}
          </Text>
          <Text
            numberOfLines={1}
            style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12, marginTop: 2 }}
          >
            {video.folder}
          </Text>
        </View>
      </PressableScale>
    </Swipeable>
  );
});

const styles = StyleSheet.create({
  thumb: { width: 110, height: 64 },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  remove: { width: 72, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '500' },
});
