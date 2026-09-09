import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { PagerDots } from '@/components/onboarding/pager-dots';
import { SlideFrame } from '@/components/onboarding/slide-frame';
import { isLastSlide, nextSlideIndex, prevSlideIndex } from '@/onboarding/policy';
import { SLIDES } from '@/onboarding/slides';
import { useOnboarding } from '@/onboarding/onboarding-provider';
import { useMediaAccess } from '@/permissions/media-access-provider';
import { openAllFilesAccessSettings } from '@/subtitles/storage-access';
import { useTheme } from '@/theme/theme-provider';

export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { complete } = useOnboarding();
  const { videoAccess, requestVideoAccess, allFilesAccess, recheckAllFilesAccess } = useMediaAccess();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = isLastSlide(index, SLIDES.length);

  const finish = useCallback(async () => {
    await complete();
    router.replace('/(tabs)');
  }, [complete, router]);

  const advance = useCallback(() => {
    if (last) {
      void finish();
      return;
    }
    setIndex((i) => nextSlideIndex(i, SLIDES.length));
  }, [last, finish]);

  const askVideoAccess = useCallback(async () => {
    if (videoAccess === 'blocked') {
      // Requesting again after a permanent denial resolves silently without
      // showing a dialog, so send the user where the toggle actually is.
      const pkg = Application.applicationId;
      await IntentLauncher.startActivityAsync(
        'android.settings.APPLICATION_DETAILS_SETTINGS',
        pkg ? { data: `package:${pkg}` } : undefined,
      );
      return;
    }
    if (videoAccess === 'askable') await requestVideoAccess();
    advance();
  }, [videoAccess, requestVideoAccess, advance]);

  // MANAGE_EXTERNAL_STORAGE has no runtime dialog — granting it is a trip to
  // a system settings screen. Re-probe when the app comes back to the
  // foreground rather than assuming the trip succeeded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') recheckAllFilesAccess();
    });
    return () => sub.remove();
  }, [recheckAllFilesAccess]);

  /**
   * One switch over `slide.action`, with an arm for every action from the
   * start. Tasks 5 and 6 replace the 'video-access' and 'all-files' arms in
   * place — appending a separate ternary instead would drop whichever arm was
   * written first.
   */
  const renderFooterAction = () => {
    switch (slide.action) {
      case 'video-access':
        return (
          <PillButton
            label={videoAccess === 'granted' ? 'Next' : 'Allow access to your videos'}
            onPress={videoAccess === 'granted' ? advance : askVideoAccess}
          />
        );
      case 'all-files':
        return allFilesAccess ? (
          <PillButton label="Next" onPress={advance} />
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
            <PressableScale
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel="Skip storage access for now"
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
            >
              <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
                Not now
              </AppText>
            </PressableScale>
            <PillButton label="Allow" onPress={() => void openAllFilesAccessSettings()} />
          </View>
        );
      case 'finish':
        return <PillButton label="Start watching" onPress={advance} />;
      case 'next':
      default:
        return <PillButton label="Next" onPress={advance} />;
    }
  };

  // Android hardware back walks the pager, and is a no-op on slide 1 — an
  // accidental back press should not close the app the user just installed.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setIndex((i) => prevSlideIndex(i));
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  return (
    <Screen>
      {/* `Screen` already applies the safe-area insets — do not add
          useSafeAreaInsets() padding on top of it or they double up. */}
      <View style={{ flex: 1, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
        <View style={{ alignItems: 'flex-end', paddingHorizontal: spacing.xl, height: 44, justifyContent: 'center' }}>
          {last ? null : (
            <PressableScale
              onPress={finish}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
                Skip
              </AppText>
            </PressableScale>
          )}
        </View>

        <Animated.View
          key={slide.key}
          style={{ flex: 1 }}
          entering={reducedMotion ? undefined : FadeIn.duration(220)}
          exiting={reducedMotion ? undefined : FadeOut.duration(140)}
        >
          <SlideFrame headline={slide.headline} body={slide.body} mockup={null} />
        </Animated.View>

        <View
          style={{
            paddingHorizontal: spacing.xl,
            gap: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <PagerDots count={SLIDES.length} index={index} />
          {renderFooterAction()}
        </View>
      </View>
    </Screen>
  );
}
