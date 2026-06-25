import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/theme-provider';

export function SectionHeader({ title }: { title: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.background }]}>
      <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
});
