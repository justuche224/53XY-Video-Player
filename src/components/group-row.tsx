import { memo } from 'react';
import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { MediaRow } from './media-row';
import { ThumbnailCollage } from './thumbnail-collage';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const GroupRow = memo(function GroupRow({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, icon } = useTheme();
  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  return (
    <MediaRow
      thumbnail={<ThumbnailCollage videos={group.items} style={styles.fill} />}
      title={group.title}
      titleLines={1}
      meta={`${group.count} video${group.count === 1 ? '' : 's'}`}
      percent={percent}
      durationMs={totalMs}
      onPress={onPress}
      trailing={<Ionicons name="chevron-forward" size={icon.md} color={colors.onSurfaceVariant ?? colors.onSurface} />}
    />
  );
});

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
