// src/components/player/player-gestures.tsx
import type { ReactNode } from 'react';
import { useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { PlayerGestureRelationsProvider } from './player-gesture-relations';

interface PlayerGesturesProps {
  onToggleControls: () => void;
  /** Fires on a confirmed double-tap with the tap x and the full layer width. */
  onDoubleTap: (x: number, width: number) => void;
  onBoostStart: () => void;
  onBoostEnd: () => void;
  onPanStart: () => void;
  onPanMove: (x: number, translationX: number, translationY: number, width: number, height: number) => void;
  onPanEnd: () => void;
  children?: ReactNode;
}

export function PlayerGestures({
  onToggleControls,
  onDoubleTap,
  onBoostStart,
  onBoostEnd,
  onPanStart,
  onPanMove,
  onPanEnd,
  children,
}: PlayerGesturesProps) {
  // Full-screen dimensions, worklet-accessible.
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const singleTapRef = useRef<GestureType | undefined>(undefined);
  const doubleTapRef = useRef<GestureType | undefined>(undefined);
  const longPressRef = useRef<GestureType | undefined>(undefined);
  const panRef = useRef<GestureType | undefined>(undefined);

  const playerGestureRelations = useMemo(
    () => [singleTapRef, doubleTapRef, longPressRef, panRef],
    [],
  );

  const composed = useMemo(() => {
    // No maxDuration cap — a slightly-long press should still count as a tap
    // (so double-tap detection isn't flaky); the 350ms long-press handles holds.
    const singleTap = Gesture.Tap()
      .withRef(singleTapRef)
      .numberOfTaps(1)
      .onEnd((_e, success) => {
        'worklet';
        if (success) scheduleOnRN(onToggleControls);
      });

    const doubleTap = Gesture.Tap()
      .withRef(doubleTapRef)
      .numberOfTaps(2)
      .onEnd((e, success) => {
        'worklet';
        if (success) scheduleOnRN(onDoubleTap, e.x, width.value);
      });

    const longPress = Gesture.LongPress()
      .withRef(longPressRef)
      .minDuration(350)
      // Large travel tolerance so finger drift/shake doesn't cancel the 2× boost
      // once it's held — only lifting ends it (onFinalize). RNGH's default
      // maxDistance (~10px) would otherwise drop the boost on the slightest move.
      .maxDistance(100000)
      .onStart(() => {
        'worklet';
        scheduleOnRN(onBoostStart);
      })
      .onFinalize(() => {
        'worklet';
        scheduleOnRN(onBoostEnd);
      });

    const pan = Gesture.Pan()
      .withRef(panRef)
      .onStart(() => {
        'worklet';
        scheduleOnRN(onPanStart);
      })
      .onUpdate((e) => {
        'worklet';
        scheduleOnRN(onPanMove, e.x, e.translationX, e.translationY, width.value, height.value);
      })
      .onEnd(() => {
        'worklet';
        scheduleOnRN(onPanEnd);
      });

    return Gesture.Race(pan, longPress, Gesture.Exclusive(doubleTap, singleTap));
  }, [onToggleControls, onDoubleTap, onBoostStart, onBoostEnd, onPanStart, onPanMove, onPanEnd]);

  return (
    <PlayerGestureRelationsProvider value={playerGestureRelations}>
      <GestureDetector gesture={composed}>
        <View
          style={StyleSheet.absoluteFill}
          onLayout={(ev) => {
            width.value = ev.nativeEvent.layout.width;
            height.value = ev.nativeEvent.layout.height;
          }}>
          {children}
        </View>
      </GestureDetector>
    </PlayerGestureRelationsProvider>
  );
}
