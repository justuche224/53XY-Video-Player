// src/components/player/seekbar.tsx
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/theme-provider';

interface SeekbarProps {
  positionSec: number;
  durationSec: number;
  onSeek: (sec: number) => void;
}

export function Seekbar({ positionSec, durationSec, onSeek }: SeekbarProps) {
  const { colors } = useTheme();

  // Layout width stored in a shared value so it is worklet-accessible
  const barWidth = useSharedValue(0);

  const isDragging = useSharedValue(false);
  // 0–1 fraction, updated while dragging
  const dragProgress = useSharedValue(0);

  // Live progress (0–1), computed on JS thread; re-used in animated style
  const liveProgress =
    durationSec > 0 ? Math.min(1, Math.max(0, positionSec / durationSec)) : 0;
  // Mirror liveProgress into a shared value so worklets can read it
  const liveProgressSV = useSharedValue(liveProgress);
  liveProgressSV.value = liveProgress;

  const commitSeek = (fraction: number) => {
    onSeek(fraction * (durationSec > 0 ? durationSec : 0));
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      'worklet';
      isDragging.value = true;
      if (barWidth.value > 0) {
        dragProgress.value = Math.min(1, Math.max(0, e.x / barWidth.value));
      }
    })
    .onUpdate((e) => {
      'worklet';
      if (barWidth.value > 0) {
        dragProgress.value = Math.min(1, Math.max(0, e.x / barWidth.value));
      }
    })
    .onEnd(() => {
      'worklet';
      const fraction = dragProgress.value;
      isDragging.value = false;
      runOnJS(commitSeek)(fraction);
    })
    .onFinalize(() => {
      'worklet';
      isDragging.value = false;
    });

  const filledStyle = useAnimatedStyle(() => {
    const progress = isDragging.value ? dragProgress.value : liveProgressSV.value;
    return { width: `${progress * 100}%` as `${number}%` };
  });

  const thumbStyle = useAnimatedStyle(() => {
    const progress = isDragging.value ? dragProgress.value : liveProgressSV.value;
    return { left: `${progress * 100}%` as `${number}%` };
  });

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.hitArea}
        onLayout={(e) => {
          barWidth.value = e.nativeEvent.layout.width;
        }}>
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
