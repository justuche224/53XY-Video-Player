import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { useTheme } from '@/theme/theme-provider';

export function MediaCard({
  thumbnail,
  title,
  meta,
  percent = 0,
  durationMs,
  onPress,
}: {
  thumbnail: ReactNode;
  title: string;
  meta?: string;
  percent?: number;
  durationMs?: number | null;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ flex: 1, margin: spacing.sm, borderRadius: radius.md, overflow: 'hidden' }}>
      <View style={[styles.poster, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        {thumbnail}
        <DurationBadge ms={durationMs} />
        {percent > 0 ? (
          <View style={styles.progress}><ProgressBar percent={percent} /></View>
        ) : null}
      </View>
      <View style={{ marginTop: spacing.sm, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>{title}</AppText>
        {meta ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{meta}</AppText> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  poster: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
