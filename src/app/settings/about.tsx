import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { useTheme } from '@/theme/theme-provider';

export default function AboutScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="About" variant="detail" onBack={() => router.back()} />
      <View style={{ gap: spacing.xs, paddingTop: spacing.lg }}>
        <AppText variant="display">53XY</AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>Version {version}</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface} style={{ marginTop: spacing.md }}>
          A fast, local video player with smart library grouping, resume, and Material You theming.
        </AppText>
      </View>
    </Screen>
  );
}
