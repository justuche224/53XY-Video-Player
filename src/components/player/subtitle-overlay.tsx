import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SubtitleSize = 's' | 'm' | 'l' | 'xl';

const FONT_SIZES: Record<SubtitleSize, number> = { s: 14, m: 17, l: 20, xl: 24 };

/** Clearance for the bottom bar when the chrome is showing. */
const LIFTED_OFFSET = 96;
const RESTING_OFFSET = 24;

/**
 * External-subtitle text, drawn over the video.
 *
 * Player chrome, so fixed colours rather than Material You (HANDOFF §4).
 * pointerEvents none throughout: this must never enter touch dispatch or it
 * would break the gesture arena underneath.
 *
 * Not visible in PiP or background playback — it is a React view, not part
 * of the video surface.
 */
export function SubtitleOverlay({
  text,
  sizeKey,
  lifted,
}: {
  text: string;
  sizeKey: SubtitleSize;
  /** True when the controls chrome is visible, so the text clears the bottom bar. */
  lifted: boolean;
}) {
  const insets = useSafeAreaInsets();
  if (!text) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.container,
        { bottom: (lifted ? LIFTED_OFFSET : RESTING_OFFSET) + insets.bottom },
      ]}>
      <Text
        allowFontScaling={false}
        style={[styles.text, { fontSize: FONT_SIZES[sizeKey] }]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: '5%',
  },
  text: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    // A heavy shadow rather than a background box: readable over bright
    // frames without a slab of black sitting on the picture.
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
