// src/components/player/top-bar.tsx
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '@/theme/theme-provider';
import { ChromeButton } from './chrome-button';

interface TopBarProps {
  title: string;
  onBack: () => void;
  /** Optional right-side slot (rotate/tracks buttons added in Task 5) */
  right?: ReactNode;
}

export function TopBar({ title, onBack, right }: TopBarProps) {
  const { spacing } = useTheme();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.row, { paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}>
      <ChromeButton onPress={onBack}>
        <MaterialIcons name="arrow-back" size={24} color="#fff" />
      </ChromeButton>

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
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#fff',
  },
  rightSlot: {
    minWidth: 40,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
