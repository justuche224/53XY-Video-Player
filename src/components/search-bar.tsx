// src/components/search-bar.tsx
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export function SearchBar({
  value,
  onChangeText,
  tone = 'surface',
  autoFocus = false,
  onClose,
}: {
  value: string;
  onChangeText: (t: string) => void;
  /** `artwork` is the fixed dark chip used inside the Home header. */
  tone?: 'surface' | 'artwork';
  autoFocus?: boolean;
  /** When set, the trailing control closes the field once the query is empty. */
  onClose?: () => void;
}) {
  const { colors, radius } = useTheme();
  const onArtwork = tone === 'artwork';
  const background = onArtwork
    ? ON_ARTWORK.chip
    : (colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222');
  const foreground = onArtwork ? ON_ARTWORK.primary : colors.onSurface;
  const hint = onArtwork ? ON_ARTWORK.secondary : (colors.onSurfaceVariant ?? '#888');

  return (
    <View style={[styles.container, { backgroundColor: background, borderRadius: radius.pill }]}>
      <Ionicons name="search" size={20} color={hint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search"
        placeholderTextColor={hint}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.input, { color: foreground }]}
      />
      {value.length > 0 || onClose ? (
        <Pressable
          onPress={() => (value.length > 0 ? onChangeText('') : onClose?.())}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={value.length > 0 ? 'Clear search' : 'Close search'}>
          <Ionicons name="close-circle" size={20} color={hint} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 9,
    paddingLeft: 8,
    fontSize: 15,
  },
});
