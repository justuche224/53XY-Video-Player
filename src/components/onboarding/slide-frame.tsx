import type { ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

/**
 * The shared composition every slide uses: mockup in the upper band, copy
 * beneath it, actions pinned to the bottom by the caller. Fixing the mockup
 * band's height here is what stops the headline from jumping between slides.
 */
export function SlideFrame({
  headline,
  body,
  mockup,
}: {
  headline: string;
  body: string;
  mockup: ReactNode;
}) {
  const { colors, spacing } = useTheme();
  const { height } = useWindowDimensions();
  const bandHeight = Math.round(Math.min(360, Math.max(240, height * 0.4)));

  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.xl }}>
      <View style={{ height: bandHeight, alignItems: 'center', justifyContent: 'center' }}>
        {mockup}
      </View>
      <View style={{ gap: spacing.md, paddingTop: spacing.xl }}>
        <AppText variant="display">{headline}</AppText>
        <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {body}
        </AppText>
      </View>
    </View>
  );
}
