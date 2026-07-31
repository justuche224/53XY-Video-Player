import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export type IconButtonTone = 'surface' | 'artwork' | 'plain';

export const ICON_BUTTON_SIZE = 40;

/**
 * The app's canonical circular icon button (M3 Expressive filled-tonal icon
 * button). Replaces the old bare `Pressable` + `Ionicons` pairs that sat inside a
 * shared grey rounded-rect.
 *
 * `tone="artwork"` is for buttons floating over video artwork: a fixed dark chip
 * with a white glyph, which stays legible over any frame *and* over the page
 * background in either theme — so a header button crossing from hero to page
 * never has to animate its colours (see ON_ARTWORK).
 */
export function IconButton({
  name,
  onPress,
  tone = 'surface',
  active = false,
  tint,
  disabled = false,
  accessibilityLabel,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  tone?: IconButtonTone;
  /** Renders as a filled `primary` chip — for toggles that are currently on. */
  active?: boolean;
  /** Overrides the glyph colour, for semantic actions (destructive, primary). */
  tint?: string;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  const { colors, icon, radius, isDark } = useTheme();

  const background = active
    ? colors.primary
    : tone === 'artwork'
      ? ON_ARTWORK.chip
      : tone === 'plain'
        ? 'transparent'
        : (colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222');

  const foreground =
    tint ??
    (active
      ? (colors.onPrimary ?? '#fff')
      : tone === 'artwork'
        ? ON_ARTWORK.primary
        : (colors.onSurfaceVariant ?? colors.onSurface));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      hitSlop={6}
      android_ripple={{
        color: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)',
        borderless: false,
        radius: ICON_BUTTON_SIZE / 2,
      }}
      style={{ borderRadius: radius.pill, overflow: 'hidden', opacity: disabled ? 0.38 : 1 }}>
      <View
        style={{
          width: ICON_BUTTON_SIZE,
          height: ICON_BUTTON_SIZE,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: background,
        }}>
        <Ionicons name={name} size={icon.sm + 2} color={foreground} />
      </View>
    </Pressable>
  );
}
