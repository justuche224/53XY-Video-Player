import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { DurationBadge } from './duration-badge';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function EpisodeRow({ video, percent, onPress }: { video: LibraryVideo; percent: number; onPress: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  return (
    <PressableScale onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.md, borderRadius: radius.md, overflow: 'hidden' }}>
      <View>
        <VideoThumbnail video={video} style={styles.thumb} />
        <DurationBadge ms={video.durationMs} />
      </View>
      <View style={{ flex: 1 }}>
        {label ? <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{label}</Text> : null}
        <Text numberOfLines={2} style={[styles.title, { color: colors.onSurface }]}>{video.filename}</Text>
        <View style={{ marginTop: 4 }}><ProgressBar percent={percent} /></View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 110, height: 64 },
  title: { fontSize: 14, fontWeight: '500' },
});
