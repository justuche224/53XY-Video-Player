import { View, type StyleProp, type ViewStyle } from 'react-native';

export interface GradientStop {
  color: string;
  /** CSS-style position, e.g. `'0%'` or `'62%'`. Omit to distribute evenly. */
  at?: string;
}

/**
 * A linear-gradient fill, used for every scrim in the app (hero banner, poster
 * overlays, pinned-header backdrop).
 *
 * This is React Native 0.85's built-in `experimental_backgroundImage` — no
 * `expo-linear-gradient`, so nothing here needs a native rebuild. Every gradient
 * in the app goes through this one component so that if the experimental prop
 * turns out not to render on this Android build, the fallback (a stack of ~10
 * evenly-stepped opacity Views) can be swapped in here and nowhere else.
 *
 * Defaults to `pointerEvents="none"`: a scrim is decoration and must never eat a
 * touch meant for the artwork or a button beneath it.
 */
export function Gradient({
  stops,
  direction = '180deg',
  style,
}: {
  stops: GradientStop[];
  /** CSS angle or keyword. `'180deg'` is top → bottom. */
  direction?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          experimental_backgroundImage: [
            {
              type: 'linear-gradient' as const,
              direction,
              colorStops: stops.map((s) => ({
                color: s.color,
                ...(s.at ? { positions: [s.at] } : null),
              })),
            },
          ],
        },
        style,
      ]}
    />
  );
}

/** Transparent black, for scrim stops that must fade to nothing without greying. */
export const CLEAR = 'rgba(0,0,0,0)';
