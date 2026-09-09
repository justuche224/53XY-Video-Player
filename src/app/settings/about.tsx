import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { ListItem } from '@/components/list-item';
import { Screen } from '@/components/screen';
import { useOnboarding } from '@/onboarding/onboarding-provider';
import { useTheme } from '@/theme/theme-provider';

export default function AboutScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const version = Constants.expoConfig?.version ?? '—';
  const { restart } = useOnboarding();

  // About is a *pushed* route, so the stack starts as [(tabs), settings/about].
  // dismissAll() collapses that back to [(tabs)] first — synchronously, before
  // `restart()` (async: several settings writes, then flips `status`) has any
  // chance to fire the gate's redirect. That ordering matters: if the gate's
  // `replace('/onboarding')` landed first, it would swap only the top of the
  // still-two-deep stack, leaving [(tabs), onboarding], and finishing the tour
  // would then land on [(tabs), (tabs)] — Android back from Home would pop to
  // a second Home instead of exiting. Collapsing first means the gate always
  // sees a one-deep stack and produces the same [onboarding] shape as a fresh
  // install.
  //
  // The navigation into `/onboarding` itself is intentionally NOT done here:
  // `restart()` only flips status to 'needed', and OnboardingGate is the
  // single place that reacts to that by calling `replace('/onboarding')`.
  // Doing it here too would race the gate's own effect and could double-fire
  // the replace, remounting the tour (double fade, slide index reset) — see
  // the gate's comment.
  const replay = async () => {
    router.dismissAll();
    await restart();
  };

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
      <View style={{ paddingTop: spacing.xl }}>
        <ListItem
          icon="sparkles-outline"
          title="Show the tour again"
          subtitle="Replay the intro and the in-app tips"
          onPress={replay}
        />
      </View>
    </Screen>
  );
}
