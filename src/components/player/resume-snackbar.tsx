// src/components/player/resume-snackbar.tsx
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';
import { formatTime } from '@/player/format-time';

interface ResumeSnackbarProps {
  /** Position in seconds that was resumed from */
  positionSec: number;
  onDismiss: () => void;
  onRestart: () => void;
}

const AUTO_DISMISS_MS = 4000;

export function ResumeSnackbar({ positionSec, onDismiss, onRestart }: ResumeSnackbarProps) {
  const { colors, spacing, radius } = useTheme();

  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

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
        Resumed at {formatTime(positionSec)}
      </Text>
      <Text style={[styles.dot, { color: colors.inverseOnSurface ?? '#fff' }]}>{'·'}</Text>
      <PressableScale
        onPress={() => {
          onRestart();
          onDismiss();
        }}
        style={styles.restartButton}>
        <Text style={[styles.restartLabel, { color: colors.inversePrimary ?? '#90caf9' }]}>
          Restart
        </Text>
      </PressableScale>
    </View>
  );
}

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
  restartButton: {
    paddingHorizontal: 4,
  },
  restartLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
});
