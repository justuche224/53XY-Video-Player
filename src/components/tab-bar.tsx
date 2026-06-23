import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabIconFor, tabLabelFor } from '@/navigation/tab-icon';
import { useTheme } from '@/theme/theme-provider';

const BAR_HEIGHT = 64;
const PILL_W = 56;
const PILL_H = 32;
const PILL_TOP = 8;

// Vertical space a tab screen should leave at the bottom of its scroll content
// so the last item clears the (flush) bar.
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + 8;

const SPRING = { damping: 18, stiffness: 200, mass: 0.8 };

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / count : 0;

  const pos = useSharedValue(state.index);
  useEffect(() => {
    pos.value = withSpring(state.index, SPRING);
  }, [state.index, pos]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value * tabWidth + (tabWidth - PILL_W) / 2 }],
  }));

  const barBg = colors.surfaceVariant ?? '#1c1b1f';
  const pillBg = colors.secondaryContainer ?? colors.primaryContainer ?? colors.primary;
  const activeFg = colors.onSecondaryContainer ?? colors.onPrimaryContainer ?? colors.onPrimary ?? '#fff';
  const inactiveFg = colors.onSurfaceVariant ?? '#999';

  return (
    <View
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      style={[
        styles.bar,
        {
          backgroundColor: barBg,
          paddingBottom: insets.bottom,
          borderTopColor: colors.outline ?? 'rgba(255,255,255,0.08)',
        },
      ]}
    >
      <View style={[styles.row, { height: BAR_HEIGHT }]}>
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              { width: PILL_W, height: PILL_H, borderRadius: PILL_H / 2, top: PILL_TOP, backgroundColor: pillBg },
              pillStyle,
            ]}
          />
        ) : null}

        {state.routes.map((route, i) => {
          const icon = tabIconFor(route.name);
          const focused = state.index === i;
          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              hitSlop={8}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  Haptics.selectionAsync();
                  navigation.navigate(route.name as never);
                }
              }}
            >
              <View style={[styles.iconBox, { height: PILL_H }]}>
                <Ionicons name={focused ? icon.active : icon.inactive} size={24} color={focused ? activeFg : inactiveFg} />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color: focused ? colors.onSurface : inactiveFg, fontWeight: focused ? '700' : '500' }]}
              >
                {tabLabelFor(route.name)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  pill: { position: 'absolute' },
  tab: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-start', paddingTop: PILL_TOP, gap: 3 },
  iconBox: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11 },
});
