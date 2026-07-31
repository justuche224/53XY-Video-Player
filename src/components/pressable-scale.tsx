import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme/theme-provider';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({
  onPress,
  onLongPress,
  disabled,
  children,
  style,
  morph,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * M3 Expressive shape morph: the corner radius animates alongside the press
   * scale. Cards round *up* on press; buttons flatten *down*, which is the
   * direction M3's button-group morph runs.
   */
  morph?: { from: number; to: number };
}) {
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
    ...(morph ? { borderRadius: morph.from + (morph.to - morph.from) * pressed.value } : null),
  }));
  const { isDark } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => (pressed.value = withTiming(1, { duration: 60 }))}
      onPressOut={() => (pressed.value = withTiming(0, { duration: 140 }))}
      android_ripple={{ color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
