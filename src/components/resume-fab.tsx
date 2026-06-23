import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/theme/theme-provider';

export function ResumeFab({ onPress, bottomOffset = 0 }: { onPress: () => void; bottomOffset?: number }) {
  const { colors, spacing } = useTheme();
  const fg = colors.onPrimaryContainer ?? colors.onPrimary ?? '#fff';
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: fg, borderless: false }}
      style={[
        styles.fab,
        {
          backgroundColor: colors.primaryContainer ?? colors.primary,
          bottom: spacing.lg + bottomOffset,
          right: spacing.lg,
        },
      ]}
    >
      <Ionicons name="play" size={20} color={fg} />
      <Text style={[styles.label, { color: fg }]}>Resume</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  label: { fontSize: 15, fontWeight: '700' },
});
