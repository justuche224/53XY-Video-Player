import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ON_ARTWORK } from '@/theme/resolve-theme';
import { ChromeButton } from './chrome-button';
import { usePlayerGestureRelations } from './player-gesture-relations';

/** Range and granularity of the delay control. */
export const DELAY_RANGE_MS = 20000;
const STEP_MS = 50;
/** Idle time before the bar fades away on its own. */
const AUTO_HIDE_MS = 4000;

function quantize(ms: number): number {
  const clamped = Math.max(-DELAY_RANGE_MS, Math.min(DELAY_RANGE_MS, ms));
  return Math.round(clamped / STEP_MS) * STEP_MS;
}

function formatDelay(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}s`;
}

export function SubtitleDelayBar({
  delayMs,
  onChange,
  onClose,
}: {
  delayMs: number;
  onChange: (ms: number) => void;
  onClose: () => void;
}) {
  const relations = usePlayerGestureRelations();
  const barWidth = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragFraction = useSharedValue(0);

  // Mirror the resting delay into a shared value for the thumb's position.
  const restFraction = (delayMs + DELAY_RANGE_MS) / (2 * DELAY_RANGE_MS);
  const restFractionSV = useSharedValue(restFraction);
  useEffect(() => {
    restFractionSV.value = restFraction;
  }, [restFraction, restFractionSV]);

  // ── Auto-hide ─────────────────────────────────────────────────────────
  const [interactions, setInteractions] = useState(0);
  const bump = useCallback(() => setInteractions((n) => n + 1), []);
  const draggingJs = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => {
      if (!draggingJs.current) onClose();
    }, AUTO_HIDE_MS);
    return () => clearTimeout(id);
  }, [interactions, onClose]);

  const commit = useCallback(
    (fraction: number) => {
      onChange(quantize(fraction * 2 * DELAY_RANGE_MS - DELAY_RANGE_MS));
      bump();
    },
    [onChange, bump],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      onChange(quantize(delayMs + deltaMs));
      bump();
    },
    [delayMs, onChange, bump],
  );

  const setDraggingJs = useCallback((value: boolean) => {
    draggingJs.current = value;
  }, []);

  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .minDistance(0)
      .onBegin((e) => {
        'worklet';
        dragging.value = true;
        scheduleOnRN(setDraggingJs, true);
        if (barWidth.value > 0) {
          const f = Math.min(1, Math.max(0, e.x / barWidth.value));
          dragFraction.value = f;
          scheduleOnRN(commit, f);
        }
      })
      .onUpdate((e) => {
        'worklet';
        if (barWidth.value > 0) {
          const f = Math.min(1, Math.max(0, e.x / barWidth.value));
          dragFraction.value = f;
          // Live: cues shift under the finger rather than on release.
          scheduleOnRN(commit, f);
        }
      })
      .onFinalize(() => {
        'worklet';
        restFractionSV.value = dragFraction.value;
        dragging.value = false;
        scheduleOnRN(setDraggingJs, false);
      });
    // Same arena discipline as PlayerPressableScale: without this the
    // screen's brightness/volume pan fights the slider.
    if (relations) g.blocksExternalGesture(...relations);
    return g;
  }, [relations, commit, setDraggingJs, barWidth, dragFraction, dragging, restFractionSV]);

  const filledStyle = useAnimatedStyle(() => {
    const f = dragging.value ? dragFraction.value : restFractionSV.value;
    return { width: `${f * 100}%` as `${number}%` };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const f = dragging.value ? dragFraction.value : restFractionSV.value;
    return { left: `${f * 100}%` as `${number}%` };
  });

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: ON_ARTWORK.chip }]}>
        <View style={styles.row}>
          <ChromeButton size={36} onPress={() => nudge(-500)}>
            <Text style={styles.nudgeLabel}>−0.5</Text>
          </ChromeButton>
          <ChromeButton size={36} onPress={() => nudge(-100)}>
            <Text style={styles.nudgeLabel}>−0.1</Text>
          </ChromeButton>
          <Text style={styles.value}>{formatDelay(delayMs)}</Text>
          <ChromeButton size={36} onPress={() => nudge(100)}>
            <Text style={styles.nudgeLabel}>+0.1</Text>
          </ChromeButton>
          <ChromeButton size={36} onPress={() => nudge(500)}>
            <Text style={styles.nudgeLabel}>+0.5</Text>
          </ChromeButton>
          <ChromeButton
            size={36}
            onPress={() => {
              onChange(0);
              bump();
            }}>
            <MaterialIcons name="restart-alt" size={18} color="#fff" />
          </ChromeButton>
        </View>

        <GestureDetector gesture={pan}>
          <View
            style={styles.hitArea}
            onLayout={(e) => {
              barWidth.value = e.nativeEvent.layout.width;
            }}>
            <View style={styles.track}>
              <Animated.View style={[styles.filled, filledStyle]} />
            </View>
            <Animated.View style={[styles.thumb, thumbStyle]} />
          </View>
        </GestureDetector>

        <Text style={styles.hint}>Positive delay shows subtitles later</Text>
      </View>
    </View>
  );
}

const TRACK_HEIGHT = 4;
const THUMB_SIZE = 16;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  bar: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 12, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nudgeLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  value: { color: '#fff', fontSize: 15, fontWeight: '700', minWidth: 64, textAlign: 'center' },
  hitArea: { height: 28, justifyContent: 'center' },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
    marginHorizontal: THUMB_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filled: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, backgroundColor: '#9C8CFF' },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    marginLeft: -(THUMB_SIZE / 2),
    top: '50%',
    marginTop: -(THUMB_SIZE / 2),
    backgroundColor: '#9C8CFF',
  },
  hint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },
});
