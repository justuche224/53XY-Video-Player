// Purpose: explanation. A 2×2 of the four gestures with their zones drawn on
// a stand-in video frame — the point is *where* on the screen each one lives,
// which a list of words cannot carry.
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

type IoniconName = keyof typeof Ionicons.glyphMap;

const GESTURES: { icon: IoniconName; label: string }[] = [
  { icon: 'play-forward-outline', label: 'Double-tap to skip' },
  { icon: 'sunny-outline', label: 'Swipe left edge for brightness' },
  { icon: 'volume-high-outline', label: 'Swipe right edge for volume' },
  { icon: 'speedometer-outline', label: 'Hold anywhere for 2×' },
];

export function MockupGestures() {
  const { spacing, radius, icon, shadow } = useTheme();
  return (
    <View
      style={{
        width: '100%',
        // Artwork colours are fixed white-on-scrim, not themed — a stand-in
        // video frame is arbitrary imagery, the same reason player chrome is
        // fixed (HANDOFF §4).
        backgroundColor: '#101014',
        borderRadius: radius.md,
        padding: spacing.lg,
        gap: spacing.md,
        boxShadow: shadow(2),
      }}
    >
      {GESTURES.map((g) => (
        <View key={g.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: ON_ARTWORK.tonal,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={g.icon} size={icon.md} color={ON_ARTWORK.primary} />
          </View>
          <AppText variant="body" color={ON_ARTWORK.primary} style={{ flex: 1 }}>
            {g.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
