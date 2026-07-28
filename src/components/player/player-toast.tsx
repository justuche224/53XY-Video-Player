// src/components/player/player-toast.tsx
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

/** One-line transient message in the snackbar position (e.g. "Sleep timer paused playback"). */
export function PlayerToast({ message }: { message: string }) {
  const { colors, spacing, radius } = useTheme();
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
        },
      ]}>
      <Text style={[styles.label, { color: colors.inverseOnSurface ?? '#fff' }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
});
