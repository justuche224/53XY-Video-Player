import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabIconFor } from '@/navigation/tab-icon';
import { useTheme } from '@/theme/theme-provider';

const BAR_HEIGHT = 60;
const CIRCLE = 48;
const LIFT = 20;
const MARGIN_H = 28;

// Vertical space a floating-bar screen should leave at the bottom of its
// scroll content so the last item clears the bar.
export const TAB_BAR_CLEARANCE = BAR_HEIGHT + LIFT + 24;

const SPRING = { damping: 16, stiffness: 180, mass: 0.7 };

export function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);

  const count = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / count : 0;

  const active = useSharedValue(state.index);
  useEffect(() => {
    active.value = withSpring(state.index, SPRING);
  }, [state.index, active]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: active.value * tabWidth + (tabWidth - CIRCLE) / 2 }],
  }));

  const surface = colors.surfaceVariant ?? '#222';
  const accent = colors.primary;
  const onAccent = colors.onPrimary ?? '#fff';
  const inactive = colors.onSurfaceVariant ?? '#999';

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <View
        style={[styles.bar, { height: BAR_HEIGHT, backgroundColor: surface }]}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {/* Lifted accent circle that springs to the active tab */}
        {tabWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.circle,
              { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, backgroundColor: accent, top: -LIFT },
              circleStyle,
            ]}
          />
        ) : null}

        {state.routes.map((route, i) => (
          <TabItem
            key={route.key}
            routeName={route.name}
            index={i}
            active={active}
            focused={state.index === i}
            accentFg={onAccent}
            inactiveFg={inactive}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (state.index !== i && !event.defaultPrevented) {
                Haptics.selectionAsync();
                navigation.navigate(route.name as never);
              }
            }}
          />
        ))}
      </View>
    </View>
  );
}

function TabItem({
  routeName,
  index,
  active,
  focused,
  accentFg,
  inactiveFg,
  onPress,
}: {
  routeName: string;
  index: number;
  active: SharedValue<number>;
  focused: boolean;
  accentFg: string;
  inactiveFg: string;
  onPress: () => void;
}) {
  const icon = tabIconFor(routeName);
  // Lift the icon up into the circle only while this tab is the active one.
  const lift = useDerivedValue(() =>
    interpolate(active.value, [index - 1, index, index + 1], [0, -LIFT, 0], 'clamp'),
  );
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Pressable style={styles.tab} onPress={onPress} hitSlop={8}>
      <Animated.View style={iconStyle}>
        <Ionicons
          name={focused ? icon.active : icon.inactive}
          size={24}
          color={focused ? accentFg : inactiveFg}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: MARGIN_H, right: MARGIN_H },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 32,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  circle: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' },
});
