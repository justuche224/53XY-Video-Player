import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { useTheme } from '@/theme/theme-provider';

/**
 * M3 Expressive grouped list: related settings sit together in one rounded
 * tonal cluster with hairline dividers, instead of floating loose on the page
 * background. Same separation recipe as MediaCard (elevation(2) + hairline
 * outline) so Settings speaks the app's surface language.
 */
export function SettingsGroup({
  label,
  children,
  insetDividers = true,
}: {
  label?: string;
  children: ReactNode;
  /** Inset dividers past the 40dp leading-icon column. Turn off for icon-less rows. */
  insetDividers?: boolean;
}) {
  const { colors, spacing, radius, elevation } = useTheme();
  const items = Children.toArray(children).filter(Boolean);
  const divider = colors.outlineVariant ?? colors.surfaceVariant ?? 'rgba(255,255,255,0.08)';

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? (
        <AppText
          variant="label"
          color={colors.onSurfaceVariant ?? colors.onSurface}
          style={{ paddingHorizontal: spacing.sm }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          borderRadius: radius.lg,
          backgroundColor: elevation(2),
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.outlineVariant ?? 'transparent',
          // Clips children's ripples to the rounded cluster.
          overflow: 'hidden',
          paddingHorizontal: spacing.sm,
        }}>
        {items.map((child, i) => (
          <Fragment key={i}>
            {i > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: divider,
                  // Inset past the leading icon column so the divider reads as
                  // part of the text block, M3-style.
                  marginLeft: insetDividers ? spacing.sm + 40 + spacing.md : 0,
                }}
              />
            ) : null}
            {child}
          </Fragment>
        ))}
      </View>
    </View>
  );
}
