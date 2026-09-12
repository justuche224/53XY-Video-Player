// Purpose: state change. One check, settled — the tour is over and nothing on
// this slide should compete with the single button below it.
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

import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const SIZE = 112;

export function MockupDone() {
  const { colors, radius } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    pop.set(withDelay(120, withTiming(1, { duration: 280, easing: EASE })));
  }, [reduced, pop]);

  const circle = useAnimatedStyle(() => ({
    opacity: pop.get(),
    transform: [{ scale: 0.8 + pop.get() * 0.2 }],
  }));

  return (
    <Animated.View
      style={[
        circle,
        {
          width: SIZE,
          height: SIZE,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <View accessibilityLabel="All set" accessibilityRole="image">
        <Ionicons name="checkmark" size={64} color={colors.onPrimary ?? '#fff'} />
      </View>
    </Animated.View>
  );
}
