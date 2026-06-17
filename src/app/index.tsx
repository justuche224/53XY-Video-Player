// src/app/index.tsx — temporary debug list (Plan 2B replaces this)
import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useLibrary } from '@/library/use-library';
import { useTheme } from '@/theme/theme-provider';

export default function LibraryScreen() {
  const { colors, spacing } = useTheme();
  const { status, groups, error } = useLibrary('name');
  return (
    <Screen style={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.onSurface }]}>53XY</Text>
        <Link href="/settings" style={[styles.link, { color: colors.primary }]}>
          Settings
        </Link>
      </View>
      <Text style={{ color: colors.onSurfaceVariant ?? colors.onSurface, marginBottom: spacing.sm }}>
        status: {status} · {groups.length} groups {error ? `· ${error}` : ''}
      </Text>
      <ScrollView>
        {groups.map((g) => (
          <Text key={g.key} style={{ color: colors.onSurface, paddingVertical: 4 }}>
            {g.title} — {g.count} video{g.count === 1 ? '' : 's'}
          </Text>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  link: { fontSize: 16, fontWeight: '600' },
});
