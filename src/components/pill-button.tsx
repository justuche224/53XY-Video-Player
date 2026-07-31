import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { ON_ARTWORK, RADIUS } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export type PillTone = 'filled' | 'tonal' | 'artwork';

/**
 * M3 Expressive filled / filled-tonal button. Rests at `corner.full` and morphs
 * *down* to `corner.large` while pressed — the direction M3's button-group shape
 * morph runs, and the app's one deliberate Expressive flourish.
 */
export function PillButton({
  label,
  icon,
  onPress,
  tone = 'filled',
}: {
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** `artwork` is the tonal variant for buttons sitting on a video frame. */
  tone?: PillTone;
}) {
  const { colors, spacing, icon: iconSize } = useTheme();

  const background =
    tone === 'filled'
      ? colors.primary
      : tone === 'artwork'
        ? ON_ARTWORK.tonal
        : (colors.secondaryContainer ?? colors.surfaceVariant ?? '#222');

  const foreground =
    tone === 'filled'
      ? (colors.onPrimary ?? '#fff')
      : tone === 'artwork'
        ? ON_ARTWORK.primary
        : (colors.onSecondaryContainer ?? colors.onSurface);

  return (
    <PressableScale
      onPress={onPress}
      morph={{ from: RADIUS.pill, to: RADIUS.md }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md - 1,
        borderRadius: RADIUS.pill,
        backgroundColor: background,
      }}>
      {icon ? <Ionicons name={icon} size={iconSize.sm} color={foreground} /> : null}
      <AppText variant="label" color={foreground}>
        {label}
      </AppText>
    </PressableScale>
  );
}

/** Keeps the hero's two buttons the same height when only one has an icon. */
export function PillRow({ children, gap }: { children: React.ReactNode; gap: number }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap }}>{children}</View>;
}
