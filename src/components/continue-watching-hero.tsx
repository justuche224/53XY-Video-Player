import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { AppText } from './app-text';
import { PressableScale } from './pressable-scale';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';
import { THUMB_WIDTH_HERO } from '@/media/thumb-policy';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

export function ContinueWatchingHero({
  video,
  percent,
  onPress,
}: {
  video: LibraryVideo;
  percent: number;
  onPress: () => void;
}) {
  const { colors, spacing, radius, icon, elevation } = useTheme();
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  const remainingMs = video.durationMs ? video.durationMs * (1 - Math.min(percent, 1)) : 0;
  const remaining = remainingMs > 0 ? `${formatTime(remainingMs / 1000)} left` : 'Resume';
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View entering={reducedMotion ? undefined : FadeInDown.duration(280)}>
      <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: elevation(2), borderRadius: radius.xl, padding: spacing.sm, marginBottom: spacing.md, gap: spacing.md }]}
    >
      <View style={[styles.poster, { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' }]}>
        <VideoThumbnail video={video} style={styles.fill} width={THUMB_WIDTH_HERO} />
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={icon.lg} color="#fff" />
        </View>
      </View>
      <View style={styles.body}>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {label ? `Continue · ${label}` : 'Continue watching'}
        </AppText>
        <AppText variant="title" numberOfLines={2}>{video.filename}</AppText>
        <View style={{ gap: 4 }}>
          <AppText variant="label" color={colors.primary}>{remaining}</AppText>
          <ProgressBar percent={percent > 0 ? percent : 0.001} />
        </View>
      </View>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center' },
  poster: { width: 140, height: 80, overflow: 'hidden' },
  fill: { width: '100%', height: '100%' },
  playOverlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  body: { flex: 1, gap: 4 },
});
