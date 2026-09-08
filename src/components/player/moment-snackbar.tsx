// src/components/player/moment-snackbar.tsx
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatTime } from '@/player/format-time';
import { SNACKBAR_MS } from '@/moments/moment-policy';
import { useTheme } from '@/theme/theme-provider';
import { PlayerPressableScale } from './player-pressable-scale';

interface MomentSnackbarProps {
  /** Position the moment was captured at. */
  positionSec: number;
  onEdit: () => void;
  onDismiss: () => void;
}

export function MomentSnackbar({ positionSec, onEdit, onDismiss }: MomentSnackbarProps) {
  const { colors, spacing, radius } = useTheme();

  // Auto-dismiss once, SNACKBAR_MS after mount. A callback ref keeps the latest
  // onDismiss without re-arming the timer on every parent re-render (the player
  // re-renders ~1x/s from timeUpdate, which otherwise resets it). Same pattern
  // as ResumeSnackbar.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), SNACKBAR_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.inverseSurface ?? 'rgba(30,30,30,0.92)',
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.xl,
        },
      ]}>
      <Text style={[styles.label, { color: colors.inverseOnSurface ?? '#fff' }]}>
        Moment saved · {formatTime(positionSec)}
      </Text>
      <Text style={[styles.dot, { color: colors.inverseOnSurface ?? '#fff' }]}>{'·'}</Text>
      <PlayerPressableScale onPress={onEdit} style={styles.editButton}>
        <Text style={[styles.editLabel, { color: colors.inversePrimary ?? '#90caf9' }]}>Edit</Text>
      </PlayerPressableScale>
    </View>
  );
}

// Copied field-for-field from ResumeSnackbar so the two snackbars are
// indistinguishable — same gap, same weights, same inversePrimary fallback.
const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  dot: {
    fontSize: 14,
  },
  editButton: {
    paddingHorizontal: 4,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
