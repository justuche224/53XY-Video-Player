import { View } from 'react-native';

import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export function ProgressBar({
  percent,
  tone = 'surface',
  height = 3,
}: {
  percent: number;
  /**
   * `artwork` draws on top of a video frame (poster overlay, hero banner), where
   * the themed `surfaceVariant` track would vanish into the image.
   */
  tone?: 'surface' | 'artwork';
  height?: number;
}) {
  const { colors, radius } = useTheme();
  if (percent <= 0) return null;

  const onArtwork = tone === 'artwork';
  const track = onArtwork ? ON_ARTWORK.track : (colors.surfaceVariant ?? '#333');
  const fill = onArtwork ? ON_ARTWORK.primary : colors.primary;

  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <View
        style={{
          height,
          width: `${Math.min(100, percent * 100)}%`,
          borderRadius: radius.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
