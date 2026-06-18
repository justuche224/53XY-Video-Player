// src/components/player/player-gestures.tsx
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface PlayerGesturesProps {
  onToggleControls: () => void;
  /** Fires on a confirmed double-tap with the tap x and the full layer width. */
  onDoubleTap: (x: number, width: number) => void;
  onBoostStart: () => void;
  onBoostEnd: () => void;
  children?: ReactNode;
}

export function PlayerGestures({
  onToggleControls,
  onDoubleTap,
  onBoostStart,
  onBoostEnd,
  children,
}: PlayerGesturesProps) {
  // Full-screen width, worklet-accessible, for left/center/right zone decisions.
  const width = useSharedValue(0);

  const composed = useMemo(() => {
    // No maxDuration cap — a slightly-long press should still count as a tap
    // (so double-tap detection isn't flaky); the 350ms long-press handles holds.
    const singleTap = Gesture.Tap()
      .numberOfTaps(1)
      .onEnd((_e, success) => {
        'worklet';
        if (success) scheduleOnRN(onToggleControls);
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e, success) => {
        'worklet';
        if (success) scheduleOnRN(onDoubleTap, e.x, width.value);
      });

    const longPress = Gesture.LongPress()
      .minDuration(350)
      .onStart(() => {
        'worklet';
        scheduleOnRN(onBoostStart);
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(onBoostEnd);
      });

    return Gesture.Race(longPress, Gesture.Exclusive(doubleTap, singleTap));
  }, [onToggleControls, onDoubleTap, onBoostStart, onBoostEnd]);

  return (
    <GestureDetector gesture={composed}>
      <View
        style={StyleSheet.absoluteFill}
        onLayout={(ev) => {
          width.value = ev.nativeEvent.layout.width;
        }}>
        {children}
      </View>
    </GestureDetector>
  );
}
