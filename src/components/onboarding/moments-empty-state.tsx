import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

const STEPS: { icon: IoniconName; text: string }[] = [
  { icon: 'play-circle-outline', text: 'Play anything and pause on a scene worth keeping.' },
  { icon: 'bookmark-outline', text: 'Tap the bookmark in the player’s top bar.' },
  { icon: 'create-outline', text: 'The note fills itself from the subtitle on screen — edit it or leave it.' },
];

/**
 * A composed empty state, not a shrug. Someone looking at this screen has
 * never made a moment, so the screen's job is to say exactly how — the tab is
 * the only place in the app where that instruction is guaranteed to be
 * relevant.
 */
export function MomentsEmptyState({ restoreSlot }: { restoreSlot?: ReactNode }) {
  const { colors, spacing, radius, icon } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, gap: spacing.xl }}>
      <View style={{ alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: radius.pill,
            backgroundColor: colors.secondaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="bookmark"
            size={icon.lg}
            color={colors.onSecondaryContainer ?? colors.onSurface}
          />
        </View>
        <AppText variant="headline">No moments yet</AppText>
        <AppText
          variant="body"
          color={colors.onSurfaceVariant ?? colors.onSurface}
          style={{ textAlign: 'center' }}
        >
          A moment saves the exact frame with its title, timestamp and the line
          being spoken — and outlives the video file.
        </AppText>
      </View>

      <View
        style={{
          backgroundColor: colors.surfaceContainer ?? colors.surfaceVariant,
          borderRadius: radius.md,
          padding: spacing.lg,
          gap: spacing.lg,
        }}
      >
        {STEPS.map((step) => (
          <View key={step.text} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Ionicons name={step.icon} size={icon.md} color={colors.primary} />
            <AppText variant="body" style={{ flex: 1 }}>
              {step.text}
            </AppText>
          </View>
        ))}
      </View>

      {restoreSlot}
    </View>
  );
}
