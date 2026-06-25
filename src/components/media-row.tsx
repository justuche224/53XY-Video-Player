import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { useTheme } from '@/theme/theme-provider';

// One canonical thumbnail size for every list row (16:9-ish).
export const ROW_THUMB = { width: 100, height: 56 } as const;

export function MediaRow({
  thumbnail,
  title,
  titleLines = 2,
  overline,
  meta,
  percent = 0,
  durationMs,
  trailing,
  onPress,
  onLongPress,
}: {
  thumbnail: ReactNode;
  title: string;
  titleLines?: number;
  overline?: string;
  meta?: string;
  percent?: number;
  durationMs?: number | null;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.row, { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md }]}
    >
      <View style={[styles.thumb, { width: ROW_THUMB.width, height: ROW_THUMB.height, borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        {thumbnail}
        <DurationBadge ms={durationMs} />
        {percent > 0 ? (
          <View style={styles.progress}><ProgressBar percent={percent} /></View>
        ) : null}
      </View>
      <View style={styles.body}>
        {overline ? <AppText variant="episode" color={colors.primary}>{overline}</AppText> : null}
        <AppText variant="title" numberOfLines={titleLines}>{title}</AppText>
        {meta ? <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>{meta}</AppText> : null}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  thumb: { overflow: 'hidden' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: { flex: 1, gap: 2 },
});
