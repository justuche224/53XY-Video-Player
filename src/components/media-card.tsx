import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { DurationBadge } from './duration-badge';
import { CLEAR, Gradient } from './gradient';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { RADIUS } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

/**
 * Grid card: a tonal container holding an inset poster plus its title and meta.
 *
 * The container is what stops the card reading as a flat box — a
 * `surfaceContainerLow` tile with an M3 level-1 shadow, so it sits above the page
 * rather than being painted on it. The poster carries its own bottom-up scrim so
 * the duration badge and resume bar stay legible over a bright frame.
 */
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
  const { colors, spacing, radius, elevation, shadow } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      morph={{ from: RADIUS.lg, to: RADIUS.xl }}
      style={{
        flex: 1,
        margin: spacing.sm,
        padding: spacing.xs + 2,
        borderRadius: radius.lg,
        backgroundColor: elevation(1),
        // Clips the Android ripple to the rounded corner. It does not clip the
        // shadow: `overflow` bounds descendants, never the element's own box-shadow.
        overflow: 'hidden',
        boxShadow: shadow(1),
      }}>
      <View
        style={[
          styles.poster,
          { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' },
        ]}>
        {thumbnail}
        <Gradient
          style={styles.posterScrim}
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
      </View>
      <View style={{ paddingHorizontal: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
            {meta}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  poster: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden' },
  posterScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
