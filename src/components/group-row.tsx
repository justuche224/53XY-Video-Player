import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { ThumbnailCollage } from './thumbnail-collage';
import { DurationBadge } from './duration-badge';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const GroupRow = memo(function GroupRow({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md, overflow: 'hidden' }}>
      <View>
        <ThumbnailCollage videos={group.items} style={styles.thumb} />
        <DurationBadge ms={totalMs} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{group.title}</Text>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12, marginBottom: 4 }}>
          {group.count} video{group.count === 1 ? '' : 's'}
        </Text>
        <ProgressBar percent={percent} />
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  thumb: { width: 96, height: 60 },
  title: { fontSize: 16, fontWeight: '600' },
});
