import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { CLEAR, Gradient } from './gradient';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { RADIUS } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

// One canonical thumbnail size for every list row (16:9-ish).
export const ROW_THUMB = { width: 112, height: 63 } as const;

/**
 * List row: the same tonal container as `MediaCard` but without the shadow, so
 * grid and list read as two deliberate densities rather than the same treatment
 * twice — a shadow under every row in a long list turns into visual noise.
 */
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
  selected = false,
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
  selected?: boolean;
}) {
  const { colors, spacing, radius, elevation } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      onLongPress={onLongPress}
      morph={{ from: RADIUS.lg, to: RADIUS.xl }}
      style={[
        styles.row,
        {
          padding: spacing.sm,
          marginBottom: spacing.sm,
          gap: spacing.md,
          borderRadius: radius.lg,
          // Matches MediaCard: the tonal step alone is too subtle against a dark
          // `background`, so the hairline outline carries the separation.
          backgroundColor: selected ? colors.secondaryContainer : elevation(2),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: selected ? colors.primary : (colors.outlineVariant ?? 'transparent'),
        },
      ]}>
      <View
        style={[
          styles.thumb,
          {
            width: ROW_THUMB.width,
            height: ROW_THUMB.height,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceVariant ?? '#222',
          },
        ]}>
        {thumbnail}
        <Gradient
          style={styles.thumbScrim}
          stops={[
            { color: CLEAR, at: '0%' },
            { color: 'rgba(0,0,0,0.55)', at: '100%' },
          ]}
        />
        <DurationBadge ms={durationMs} />
        {percent > 0 ? (
          <View style={styles.progress}>
            <ProgressBar percent={percent} tone="artwork" />
          </View>
        ) : null}
        {selected ? (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        {overline ? (
          <AppText variant="episode" color={colors.primary}>
            {overline}
          </AppText>
        ) : null}
        <AppText variant="title" numberOfLines={titleLines}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {trailing}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // overflow keeps the Android ripple inside the rounded container.
  row: { flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  thumb: { overflow: 'hidden' },
  thumbScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  body: { flex: 1, gap: 2 },
  selectedOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
