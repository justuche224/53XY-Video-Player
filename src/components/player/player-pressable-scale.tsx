import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';
import { usePlayerGestureRelations } from './player-gesture-relations';

const AnimatedGesturePressable = Animated.createAnimatedComponent(GesturePressable);

export function PlayerPressableScale({
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
  const playerGestureRelations = usePlayerGestureRelations();

  return (
    <AnimatedGesturePressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      blocksExternalGesture={playerGestureRelations ?? undefined}
      onPressIn={() => (scale.value = withTiming(0.97, { duration: 60 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 100 }))}
      android_ripple={{ color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
      style={[style, animatedStyle]}>
      {children}
    </AnimatedGesturePressable>
  );
}
