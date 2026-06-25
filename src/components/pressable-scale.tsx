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
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { isDark } = useTheme();
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withTiming(0.97, { duration: 60 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 100 }))}
      android_ripple={{ color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedPressable>
  );
}
