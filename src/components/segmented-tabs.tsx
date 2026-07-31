// src/components/segmented-tabs.tsx
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

const OPTIONS: { key: 'name' | 'folder'; label: string }[] = [
  { key: 'name', label: 'Videos' },
  { key: 'folder', label: 'Folders' },
];

export function SegmentedTabs({
  value,
  onChange,
  tone = 'surface',
}: {
  value: 'name' | 'folder';
  onChange: (v: 'name' | 'folder') => void;
  /**
   * `artwork` is the fixed dark chip used in the Home header. It reads correctly
   * both over the hero artwork and over the page background in either scheme, so
   * the pinned header never has to animate this control's colours.
   */
  tone?: 'surface' | 'artwork';
}) {
  const { colors, radius } = useTheme();
  const onArtwork = tone === 'artwork';
  const container = onArtwork
    ? ON_ARTWORK.chip
    : (colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222');
  const inactive = onArtwork ? ON_ARTWORK.secondary : (colors.onSurfaceVariant ?? colors.onSurface);

  return (
    <View style={[styles.row, { backgroundColor: container, borderRadius: radius.pill }]}>
      {OPTIONS.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.pill,
              { borderRadius: radius.pill, backgroundColor: active ? colors.primary : 'transparent' },
            ]}>
            <AppText variant="label" color={active ? (colors.onPrimary ?? '#fff') : inactive}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 4, alignSelf: 'flex-start' },
  pill: { paddingHorizontal: 18, paddingVertical: 7 },
});
