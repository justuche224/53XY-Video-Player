// src/components/player/seekbar.tsx
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useTheme } from '@/theme/theme-provider';
import { PreviewBubble, BUBBLE_WIDTH } from './preview-bubble';

interface SeekbarProps {
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
  /** When set, dragging shows a preview bubble above the thumb. */
  previewFor?: (sec: number) => string | null;
}

export function Seekbar({ positionSec, durationSec, onSeek, previewFor }: SeekbarProps) {
  const { colors } = useTheme();

  // Layout width stored in a shared value so it is worklet-accessible
  const barWidth = useSharedValue(0);
  // JS-side mirror for bubble clamping.
  const [barWidthJs, setBarWidthJs] = useState(0);
  // Dragged fraction (null = not dragging) — drives the preview bubble.
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const isDragging = useSharedValue(false);
  // 0–1 fraction, updated while dragging
  const dragProgress = useSharedValue(0);

  // Live progress (0–1), computed on JS thread; re-used in animated style
  const liveProgress =
    durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  // Mirror liveProgress into a shared value so worklets can read it. Done in an
  // effect (not during render) to avoid Reanimated's "writing during render".
  const liveProgressSV = useSharedValue(liveProgress);
  useEffect(() => {
    liveProgressSV.value = liveProgress;
  }, [liveProgress, liveProgressSV]);

  const commitSeek = (fraction: number) => {
    onSeek(fraction * (durationSec > 0 ? durationSec : 0));
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      if (barWidth.value > 0) {
        const f = Math.min(1, Math.max(0, e.x / barWidth.value));
        dragProgress.value = f;
        scheduleOnRN(setDragFraction, f);
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (barWidth.value > 0) {
        const f = Math.min(1, Math.max(0, e.x / barWidth.value));
        dragProgress.value = f;
        scheduleOnRN(setDragFraction, f);
      }
    })
    .onEnd(() => {
      'worklet';
      const fraction = dragProgress.value;
      // Pin the live shared value to the dragged position so the thumb stays
      // put until the next real timeUpdate arrives (up to ~1 s away), preventing
      // a backward snap when isDragging is cleared.
      liveProgressSV.value = fraction;
      isDragging.value = false;
      scheduleOnRN(commitSeek, fraction);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
      scheduleOnRN(setDragFraction, null);
    });

  const filledStyle = useAnimatedStyle(() => {
    const progress = isDragging.value ? dragProgress.value : liveProgressSV.value;
    return { width: `${progress * 100}%` as `${number}%` };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const progress = isDragging.value ? dragProgress.value : liveProgressSV.value;
    return { left: `${progress * 100}%` as `${number}%` };
  });

  const dragSec = dragFraction !== null ? dragFraction * durationSec : null;
  // Clamp the bubble inside the bar so it never clips at the screen edges.
  const bubbleLeft =
    dragFraction !== null && barWidthJs > 0
      ? Math.min(Math.max(dragFraction * barWidthJs, BUBBLE_WIDTH / 2), barWidthJs - BUBBLE_WIDTH / 2) -
        BUBBLE_WIDTH / 2
      : 0;

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hitArea}
        onLayout={(e) => {
          barWidth.value = e.nativeEvent.layout.width;
          setBarWidthJs(e.nativeEvent.layout.width);
        }}>
        {previewFor && dragSec !== null && (
          <View style={[styles.bubbleAnchor, { left: bubbleLeft }]} pointerEvents="none">
            <PreviewBubble targetSec={dragSec} frameUri={previewFor(dragSec)} />
          </View>
        )}
        {/* track */}
        <View style={[styles.track, { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
          {/* filled portion */}
          <Animated.View
            style={[styles.filled, { backgroundColor: colors.primary }, filledStyle]}
          />
        </View>
        {/* thumb */}
        <Animated.View
          style={[styles.thumb, { backgroundColor: colors.primary }, thumbStyle]}
        />
      </View>
    </GestureDetector>
  );
}

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;

const styles = StyleSheet.create({
  hitArea: {
    height: 28,
    justifyContent: 'center',
  },
  bubbleAnchor: {
    position: 'absolute',
    bottom: 34,
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
    marginHorizontal: THUMB_SIZE / 2,
  },
  filled: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -(THUMB_SIZE / 2),
    top: '50%',
    marginTop: -(THUMB_SIZE / 2),
  },
});
