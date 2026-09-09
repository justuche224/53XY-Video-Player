import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

export function HintChip({
  icon,
  text,
  onDismiss,
}: {
  icon: IoniconName;
  text: string;
  onDismiss: () => void;
}) {
  const { colors, spacing, radius, icon: iconSize } = useTheme();
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(140)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.secondaryContainer ?? colors.surfaceContainer ?? colors.surfaceVariant,
        borderRadius: radius.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.md,
      }}
    >
      <Ionicons
        name={icon}
        size={iconSize.md}
        color={colors.onSecondaryContainer ?? colors.onSurface}
      />
      <AppText variant="body" color={colors.onSecondaryContainer ?? colors.onSurface} style={{ flex: 1 }}>
        {text}
      </AppText>
      <PressableScale
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        hitSlop={12}
      >
        <Ionicons
          name="close"
          size={iconSize.md}
          color={colors.onSecondaryContainer ?? colors.onSurface}
        />
      </PressableScale>
    </Animated.View>
  );
}
