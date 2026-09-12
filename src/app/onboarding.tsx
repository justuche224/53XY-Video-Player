import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { PressableScale } from '@/components/pressable-scale';
import { Screen } from '@/components/screen';
import { MockupContinuity } from '@/components/onboarding/mockup-continuity';
import { MockupDone } from '@/components/onboarding/mockup-done';
import { MockupGestures } from '@/components/onboarding/mockup-gestures';
import { MockupGrouping } from '@/components/onboarding/mockup-grouping';
import { MockupMoments } from '@/components/onboarding/mockup-moments';
import { MockupWelcome } from '@/components/onboarding/mockup-welcome';
import { PagerDots } from '@/components/onboarding/pager-dots';
import { SlideFrame, type MockupFrame } from '@/components/onboarding/slide-frame';
import { isLastSlide, nextSlideIndex, prevSlideIndex } from '@/onboarding/policy';
import { SLIDES, type SlideKey } from '@/onboarding/slides';
import { useOnboarding } from '@/onboarding/onboarding-provider';
import { useMediaAccess } from '@/permissions/media-access-provider';
import { openAppSettings } from '@/permissions/open-app-settings';
import { openAllFilesAccessSettings } from '@/subtitles/storage-access';
import { useTheme } from '@/theme/theme-provider';

const MOCKUPS: Record<SlideKey, { Component: () => ReactNode; frame: MockupFrame }> = {
  welcome: { Component: MockupWelcome, frame: 'phone' },
  grouping: { Component: MockupGrouping, frame: 'phone' },
  continuity: { Component: MockupContinuity, frame: 'phone' },
  gestures: { Component: MockupGestures, frame: 'wide' },
  moments: { Component: MockupMoments, frame: 'phone' },
  done: { Component: MockupDone, frame: 'free' },
};

export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { complete } = useOnboarding();
  const { videoAccess, requestVideoAccess, allFilesAccess } = useMediaAccess();
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
      await openAppSettings();
      return;
    }
    if (videoAccess === 'askable') await requestVideoAccess();
    advance();
  }, [videoAccess, requestVideoAccess, advance]);

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

  const { Component: Mockup, frame } = MOCKUPS[slide.key];

  return (
    <Screen>
      {/* `Screen` already applies the safe-area insets — do not add
          useSafeAreaInsets() padding on top of it or they double up. */}
      <View style={{ flex: 1, paddingBottom: spacing.lg }}>
        <SlideFrame
          slideKey={slide.key}
          headline={slide.headline}
          body={slide.body}
          frame={frame}
          mockup={<Mockup />}
        />

        {/* Skip floats over the stage's top-right rather than taking a row of
            its own, so the stage can start at the very top of the screen. */}
        {last ? null : (
          <PressableScale
            onPress={finish}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
            style={[styles.skip, { right: spacing.xl }]}
          >
            <AppText variant="label" color={colors.onPrimaryContainer ?? colors.onSurface}>
              Skip
            </AppText>
          </PressableScale>
        )}

        <View
          style={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.xl,
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

const styles = StyleSheet.create({
  skip: { position: 'absolute', top: 0, height: 56, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
});
