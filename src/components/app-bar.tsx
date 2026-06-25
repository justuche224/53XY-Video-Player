import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { useTheme } from '@/theme/theme-provider';

export function AppBar({
  title,
  variant = 'large',
  onBack,
  accessory,
  right,
}: {
  title: string;
  variant?: 'large' | 'detail';
  onBack?: () => void;
  accessory?: ReactNode;
  right?: ReactNode;
}) {
  const { colors, icon } = useTheme();
  return (
    <View style={styles.bar}>
      <View style={styles.left}>
        {variant === 'detail' && onBack ? (
          <PressableScale onPress={onBack} style={styles.back}>
            <Ionicons name="arrow-back" size={icon.md} color={colors.onSurface} />
          </PressableScale>
        ) : null}
        <AppText variant={variant === 'large' ? 'display' : 'headline'} numberOfLines={1} style={styles.title}>
          {title}
        </AppText>
        {accessory}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: 16 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  back: { padding: 4 },
  title: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
