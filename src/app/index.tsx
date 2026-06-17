// src/app/index.tsx
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <Link href="/settings" style={[styles.link, { color: colors.primary }]}>
          Settings
        </Link>
      </View>
      <View style={styles.center}>
        <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface }}>
          Your library will appear here.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
