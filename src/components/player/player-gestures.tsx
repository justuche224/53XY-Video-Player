// src/components/player/player-gestures.tsx
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { tapSide } from '@/player/seek';

interface PlayerGesturesProps {
  onToggleControls: () => void;
  onSeekSide: (side: 'left' | 'right') => void;
  onBoostStart: () => void;
  onBoostEnd: () => void;
  children?: ReactNode;
}

export function PlayerGestures({
  onToggleControls,
  onSeekSide,
  onBoostStart,
  onBoostEnd,
  children,
}: PlayerGesturesProps) {
  // Full-screen width, worklet-accessible, for left/right tap-side decisions.
  const width = useSharedValue(0);

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(250)
    .onEnd((_e, success) => {
      'worklet';
      if (success) scheduleOnRN(onToggleControls);
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((e, success) => {
      'worklet';
      if (success) scheduleOnRN(onSeekSide, tapSide(e.x, width.value));
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

  const composed = Gesture.Race(longPress, Gesture.Exclusive(doubleTap, singleTap));

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
