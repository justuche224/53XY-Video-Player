import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View, Pressable } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { DurationBadge } from './duration-badge';
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
  const { colors, spacing, radius } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
      <PressableScale
        onPress={onPress}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.sm,
          gap: spacing.md,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}>
        <View>
          <VideoThumbnail video={video} style={styles.thumb} />
          <DurationBadge ms={video.durationMs} />
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>
            {video.filename}
          </Text>
          <View style={{ marginTop: 4 }}>
            <ProgressBar percent={percent} />
          </View>
        </View>
      </PressableScale>

      {/* Manual Controls */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
        <View style={{ alignItems: 'center' }}>
          <Pressable
            onPress={onMoveUp}
            disabled={!canMoveUp}
            style={{ padding: 4, opacity: canMoveUp ? 1 : 0.3 }}>
            <Ionicons name="chevron-up" size={24} color={colors.onSurfaceVariant ?? '#888'} />
          </Pressable>
          <Pressable
            onPress={onMoveDown}
            disabled={!canMoveDown}
            style={{ padding: 4, opacity: canMoveDown ? 1 : 0.3 }}>
            <Ionicons name="chevron-down" size={24} color={colors.onSurfaceVariant ?? '#888'} />
          </Pressable>
        </View>
        <Pressable onPress={onRemove} style={{ padding: 12 }}>
          <Ionicons name="trash-outline" size={20} color={colors.error ?? '#ef4444'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 110, height: 64 },
  title: { fontSize: 14, fontWeight: '500' },
});
