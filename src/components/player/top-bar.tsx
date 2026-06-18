// src/components/player/top-bar.tsx
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

interface TopBarProps {
  title: string;
  onBack: () => void;
  /** Optional right-side slot (rotate/tracks buttons added in Task 5) */
  right?: ReactNode;
}

export function TopBar({ title, onBack, right }: TopBarProps) {
  const { spacing } = useTheme();

  return (
    <View style={[styles.row, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      <PressableScale onPress={onBack} style={styles.backButton}>
        <Text style={styles.backIcon}>{'‹'}</Text>
      </PressableScale>

      <Text
        numberOfLines={1}
        style={[styles.title, { marginHorizontal: spacing.md }]}>
        {title}
      </Text>

      {/* right slot — sizes to its buttons so they never clip off-screen */}
      <View style={styles.rightSlot}>{right ?? null}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '300',
    color: '#fff',
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
  },
  rightSlot: {
    minWidth: 36,
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
