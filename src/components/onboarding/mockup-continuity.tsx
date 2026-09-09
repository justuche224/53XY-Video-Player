// Purpose: state change. The progress line filling is the whole feature —
// a static bar at 60% says "a bar exists", a bar that fills says "it
// remembers".
import { useEffect } from 'react';
import { View } from 'react-native';
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
  const { colors, spacing, radius } = useTheme();
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
        backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View
        style={{
          height: 96,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          borderRadius: radius.sm,
        }}
      />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="meta" color={colors.primary}>
          CONTINUE WATCHING
        </AppText>
        <AppText variant="title">Show · S01E02</AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          18 minutes left
        </AppText>
      </View>
      <View
        style={{
          height: 4,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceContainerHighest ?? colors.surfaceVariant,
          overflow: 'hidden',
        }}
      >
        <Animated.View style={[fill, { height: 4, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}
