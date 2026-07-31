// src/components/screen.tsx
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/theme-provider';

// Matches SafeAreaView's own default, so only screens that opt out change.
const DEFAULT_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

export function Screen({
  children,
  style,
  edges = DEFAULT_EDGES,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /**
   * Which safe-area insets to apply. Home drops `top` so the hero banner can draw
   * under the status bar; its pinned header applies the inset itself instead.
   */
  edges?: Edge[];
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
