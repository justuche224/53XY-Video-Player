// src/app/settings.tsx
import { Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  return (
    <Screen style={{ padding: spacing.lg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <View style={styles.center}>
        <Text style={{ color: colors.onSurface }}>Settings coming soon.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
