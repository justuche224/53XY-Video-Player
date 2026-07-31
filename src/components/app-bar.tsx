import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { useTheme } from '@/theme/theme-provider';

/**
 * The header for every screen except Home, which has its own pinned header over
 * the hero banner (see `home-header.tsx`).
 *
 * `large` is a page title; `detail` adds a back button and drops to the headline
 * ramp. Actions passed in `right` should be `IconButton`s so every header in the
 * app shares the same circular tonal control.
 */
export function AppBar({
  title,
  variant = 'large',
  onBack,
  accessory,
  right,
}: {
  title: string;
  variant?: 'large' | 'detail';
  onBack?: () => void;
  accessory?: ReactNode;
  right?: ReactNode;
}) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.bar, { marginBottom: spacing.lg, gap: spacing.sm }]}>
      <View style={[styles.left, { gap: spacing.sm }]}>
        {variant === 'detail' && onBack ? (
          // Pulled left so the 40dp touch target still leaves the glyph optically
          // aligned with the screen's content margin.
          <View style={styles.back}>
            <IconButton name="arrow-back" tone="plain" onPress={onBack} accessibilityLabel="Go back" />
          </View>
        ) : null}
        <AppText
          variant={variant === 'large' ? 'display' : 'headline'}
          numberOfLines={1}
          style={styles.title}>
          {title}
        </AppText>
        {accessory}
      </View>
      {right ? <View style={[styles.right, { gap: spacing.xs }]}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 48 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  back: { marginLeft: -8 },
  title: { flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
});
