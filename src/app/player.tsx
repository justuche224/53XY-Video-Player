// src/app/player.tsx
import { Stack, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function PlayerScreen() {
  const { colors } = useTheme();
  const { title } = useLocalSearchParams<{ videoId: string; uri: string; title: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: true, title: 'Player' }} />
      <View style={styles.center}>
        <Text style={{ color: colors.onSurface, fontSize: 16, textAlign: 'center' }}>
          ▶ Player coming in Plan 3{'\n'}{title}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
