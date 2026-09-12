// Purpose: explanation. The hero's progress bar fills to where the user left
// off, and history stacks under it — the two places a video is picked up from.
import { useEffect } from 'react';
import { View } from 'react-native';
import { Easing, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PhoneScreen } from '@/components/onboarding/device-frame';
import { FauxHero, FauxHistoryRow } from '@/components/onboarding/faux-home';
import { useTheme } from '@/theme/theme-provider';

const EASE = Easing.bezier(0.23, 1, 0.32, 1);
const RESUME_AT = 0.58;

export function MockupContinuity() {
  const { colors, spacing } = useTheme();
  const reduced = useReducedMotion();
  const percent = useSharedValue(reduced ? RESUME_AT : 0.08);

  useEffect(() => {
    if (reduced) return;
    percent.set(withDelay(400, withTiming(RESUME_AT, { duration: 700, easing: EASE })));
  }, [reduced, percent]);

  return (
    <PhoneScreen>
      <FauxHero still="sunset" overline="Continue · S01E02" title="Show" meta="18:04 left" percent={percent} />
      <View style={{ paddingTop: spacing.sm }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
          <AppText variant="label" color={colors.onSurfaceVariant ?? colors.onSurface}>
            Watch history
          </AppText>
        </View>
        <FauxHistoryRow still="night" title="Show · S01E01" meta="Yesterday · watched" percent={1} />
        <FauxHistoryRow still="steel" title="Lecture 04" meta="Tuesday · 41:02 of 1:12:08" percent={0.57} />
        <FauxHistoryRow still="desert" title="Trip 2025 · Day 3" meta="Last week · 12:08 of 20:30" percent={0.59} />
      </View>
    </PhoneScreen>
  );
}
