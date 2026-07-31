// src/components/player/sleep-sheet.tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';
import {
  clampCustomMinutes,
  minutesTimer,
  CUSTOM_STEP_MINUTES,
  SLEEP_PRESETS_MIN,
  type SleepTimer,
} from '@/player/sleep-timer';
import { formatTime } from '@/player/format-time';

interface SleepSheetProps {
  active: SleepTimer | null;
  /** Live remaining seconds for an active minutes timer (null otherwise). */
  remainingSec: number | null;
  onSet: (timer: SleepTimer | null) => void;
  onClose: () => void;
}

export function SleepSheet({ active, remainingSec, onSet, onClose }: SleepSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const [customMinutes, setCustomMinutes] = useState(45);

  function pick(timer: SleepTimer | null) {
    onSet(timer);
    onClose();
  }

  const rowStyle = [styles.row, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }];
  const labelColor = { color: colors.onSurface };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1e1e1e',
              borderRadius: radius.xl,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              marginHorizontal: spacing.md,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.outline ?? '#555' }]} />
          <Text style={[styles.header, labelColor, { paddingHorizontal: spacing.lg, marginBottom: spacing.sm }]}>
            Sleep timer
          </Text>

          {active && (
            <View style={rowStyle}>
              <Text style={[styles.rowLabel, labelColor]}>
                {active.kind === 'endOfVideo'
                  ? 'Active — until end of video'
                  : `Active — ${remainingSec != null ? formatTime(remainingSec) : ''} left`}
              </Text>
              <PressableScale onPress={() => pick(null)}>
                <Text style={[styles.cancelLabel, { color: colors.primary }]}>Cancel timer</Text>
              </PressableScale>
            </View>
          )}

          <PressableScale onPress={() => pick({ kind: 'endOfVideo' })}>
            <View style={rowStyle}>
              <Text style={[styles.rowLabel, labelColor]}>End of video</Text>
            </View>
          </PressableScale>

          {SLEEP_PRESETS_MIN.map((m) => (
            <PressableScale key={m} onPress={() => pick(minutesTimer(m, Date.now()))}>
              <View style={rowStyle}>
                <Text style={[styles.rowLabel, labelColor]}>{m} minutes</Text>
              </View>
            </PressableScale>
          ))}

          <View style={rowStyle}>
            <View style={styles.stepper}>
              <PressableScale
                onPress={() => setCustomMinutes((m) => clampCustomMinutes(m - CUSTOM_STEP_MINUTES))}
                style={styles.stepButton}>
                <MaterialIcons name="remove" size={22} color={colors.onSurface} />
              </PressableScale>
              <Text style={[styles.rowLabel, labelColor, styles.stepValue]}>{customMinutes} min</Text>
              <PressableScale
                onPress={() => setCustomMinutes((m) => clampCustomMinutes(m + CUSTOM_STEP_MINUTES))}
                style={styles.stepButton}>
                <MaterialIcons name="add" size={22} color={colors.onSurface} />
              </PressableScale>
            </View>
            <PressableScale onPress={() => pick(minutesTimer(customMinutes, Date.now()))}>
              <Text style={[styles.cancelLabel, { color: colors.primary }]}>Start</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    marginBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    minWidth: 64,
    textAlign: 'center',
  },
});
