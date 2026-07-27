import type { ReactNode } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { usePlayerGestureRelations } from './player-gesture-relations';

// Player chrome button. Deliberately built on a raw Gesture.Tap instead of
// RNGH's <Pressable>: the Pressable's internal state machine wedged the
// blocksExternalGesture arena on Android — after one successful button press,
// the player's full-screen gestures stayed stuck in BEGAN forever (touches
// delivered, nothing ever activated) until the detector was remounted. A plain
// Tap handler resets cleanly, keeping the same priority semantics: while a
// touch is on a button the screen gestures wait; button success cancels them,
// button failure (drag off) releases them.
export function PlayerPressableScale({
  onPress,
  disabled,
  children,
  style,
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const playerGestureRelations = usePlayerGestureRelations();

  // Latest props via ref so the gesture object never needs to be recreated
  // (recreating handlers mid-arena is exactly what we're avoiding).
  const latestRef = useRef({ onPress, disabled });
  latestRef.current = { onPress, disabled };

  const firePress = useCallback(() => {
    const { onPress: press, disabled: off } = latestRef.current;
    if (!off && press) press();
  }, []);
  const pressIn = useCallback(() => {
    scale.value = withTiming(0.97, { duration: 60 });
  }, [scale]);
  const pressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 100 });
  }, [scale]);

  const tap = useMemo(() => {
    const g = Gesture.Tap()
      // Generous hold allowance so slow, deliberate presses still fire on
      // release (RNGH Tap's 500ms default would drop them); drift beyond the
      // default maxDistance still fails the tap so pans can start on a button.
      .maxDuration(10000)
      .onBegin(() => {
        'worklet';
        scheduleOnRN(pressIn);
      })
      .onEnd((_e, success) => {
        'worklet';
        if (success) scheduleOnRN(firePress);
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(pressOut);
      });
    if (playerGestureRelations) g.blocksExternalGesture(...playerGestureRelations);
    return g;
  }, [playerGestureRelations, firePress, pressIn, pressOut]);

  return (
    <GestureDetector gesture={tap}>
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
