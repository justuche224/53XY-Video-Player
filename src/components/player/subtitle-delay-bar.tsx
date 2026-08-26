import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDelay } from '@/subtitles/format-delay';

import { ChromeButton } from './chrome-button';
import { usePlayerGestureRelations } from './player-gesture-relations';

/** Range and granularity of the delay control. */
const DELAY_RANGE_MS = 20000;
const STEP_MS = 50;
/** Idle time before the bar fades away on its own. */
const AUTO_HIDE_MS = 4000;

function quantize(ms: number): number {
  const clamped = Math.max(-DELAY_RANGE_MS, Math.min(DELAY_RANGE_MS, ms));
  return Math.round(clamped / STEP_MS) * STEP_MS;
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
  const insets = useSafeAreaInsets();
  const barWidth = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragFraction = useSharedValue(0);

  // Mirror the resting delay into a shared value for the thumb's position.
  // Clamped: a stored delay outside the range would otherwise render a >100%
  // fill and put the thumb off the track.
  const restFraction = Math.min(
    1,
    Math.max(0, (delayMs + DELAY_RANGE_MS) / (2 * DELAY_RANGE_MS)),
  );
  const restFractionSV = useSharedValue(restFraction);
  useEffect(() => {
    restFractionSV.value = restFraction;
  }, [restFraction, restFractionSV]);

  // ── Auto-hide ─────────────────────────────────────────────────────────
  // The timer lives in a ref rather than in an effect keyed on an interaction
  // counter. Two reasons: the player re-renders at >=1Hz (timeUpdateEventInterval
  // is 1), so an effect depending on the onClose prop would re-arm forever and
  // never fire; and a counter in state would force a React render on every drag
  // update. onClose is read through latestRef the way PlayerPressableScale reads
  // onPress, so an unstable prop can't restart the countdown.
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingJs = useRef(false);

  const clearHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const armHide = useCallback(() => {
    clearHide();
    hideTimerRef.current = setTimeout(() => {
      // A drag in progress defers the close; the drag-end path re-arms.
      if (draggingJs.current) return;
      latestOnClose.current();
    }, AUTO_HIDE_MS);
  }, [clearHide]);

  useEffect(() => {
    armHide();
    return clearHide;
  }, [armHide, clearHide]);

  // Deliberately does NOT depend on delayMs. commit runs on every pan update,
  // so taking delayMs here would recreate it — and with it the memoized `pan`
  // gesture — mid-drag, which is exactly the arena-wedge class this player has
  // two commits fixing. nudge may depend on delayMs; it only runs on a tap.
  const commit = useCallback(
    (fraction: number) => {
      onChange(quantize(fraction * 2 * DELAY_RANGE_MS - DELAY_RANGE_MS));
    },
    [onChange],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      onChange(quantize(delayMs + deltaMs));
      armHide();
    },
    [delayMs, onChange, armHide],
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
        scheduleOnRN(clearHide);
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
        // Re-arm here, not in commit: a timeout that fired mid-drag was
        // suppressed by the draggingJs guard and would otherwise never come
        // back, leaving the bar stuck open after a long hold.
        scheduleOnRN(armHide);
      });
    // Same arena discipline as PlayerPressableScale: without this the
    // screen's brightness/volume pan fights the slider.
    if (relations) g.blocksExternalGesture(...relations);
    return g;
  }, [
    relations,
    commit,
    setDraggingJs,
    clearHide,
    armHide,
    barWidth,
    dragFraction,
    dragging,
    restFractionSV,
  ]);

  const filledStyle = useAnimatedStyle(() => {
    const f = dragging.value ? dragFraction.value : restFractionSV.value;
    return { width: `${f * 100}%` as `${number}%` };
  });
  const thumbStyle = useAnimatedStyle(() => {
    const f = dragging.value ? dragFraction.value : restFractionSV.value;
    return { left: `${f * 100}%` as `${number}%` };
  });

  return (
    <View
      style={[styles.wrapper, { paddingBottom: 24 + insets.bottom }]}
      pointerEvents="box-none">
      {/* Darker than ON_ARTWORK.chip on purpose: ChromeButton paints each
          button with that token, so a bar in the same colour would leave the
          six chips invisible against it. */}
      <View style={[styles.bar, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
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
              armHide();
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
    // paddingBottom is applied inline, adding the safe-area inset.
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
