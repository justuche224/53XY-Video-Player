// Purpose: state change. The progress line filling is the whole feature —
// a static bar at 60% says "a bar exists", a bar that fills says "it
// remembers".
import { useEffect } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const TARGET = 0.62;

export function MockupContinuity() {
  const { colors, spacing, radius, shadow } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? TARGET : 0);

  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(300, withTiming(TARGET, { duration: 280, easing: EASE })));
  }, [reduced, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.get() * 100}%` }));

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
        boxShadow: shadow(2),
      }}
    >
      {/* A real frame shape, not a grey bar: 16:9 with the play glyph the
          hero shows over its artwork. */}
      <View
        style={{
          width: '100%',
          aspectRatio: 16 / 9,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          borderRadius: radius.sm,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="play" size={36} color={colors.onSurfaceVariant ?? colors.onSurface} />
      </View>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="meta" color={colors.primary}>
          CONTINUE WATCHING
        </AppText>
        <AppText variant="headline">Show · S01E02</AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          18 minutes left
        </AppText>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[fill, { height: 6, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}
