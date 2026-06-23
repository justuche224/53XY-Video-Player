import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

// Shared top-of-screen header for the tab roots so titles and spacing stay
// consistent. `accessory` sits next to the title (e.g. a loading spinner);
// `right` holds far-right actions (icon buttons, control pill).
export function ScreenHeader({
  title,
  accessory,
  right,
}: {
  title: string;
  accessory?: ReactNode;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
        {accessory}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: 16,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
});
