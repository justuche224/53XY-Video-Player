import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { ThumbnailCollage } from './thumbnail-collage';
import type { Group } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export const GroupCard = memo(function GroupCard({ group, percent, onPress }: { group: Group; percent: number; onPress: () => void }) {
  const { colors, spacing } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flex: 1, margin: spacing.sm }}>
      <ThumbnailCollage videos={group.items} style={styles.thumb} />
      <View style={{ marginTop: spacing.sm }}>
        <ProgressBar percent={percent} />
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface, marginTop: spacing.xs }]}>
          {group.title}
        </Text>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, fontSize: 12 }}>
          {group.count} video{group.count === 1 ? '' : 's'}
        </Text>
      </View>
    </PressableScale>
  );
});

const styles = StyleSheet.create({
  thumb: { width: '100%', aspectRatio: 16 / 10 },
  title: { fontSize: 15, fontWeight: '600' },
});
