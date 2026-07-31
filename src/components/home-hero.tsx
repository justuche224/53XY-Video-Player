import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { CLEAR, Gradient } from './gradient';
import { PillButton } from './pill-button';
import { ProgressBar } from './progress-bar';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';
import { THUMB_WIDTH_HERO } from '@/media/thumb-policy';
import { formatTime } from '@/player/format-time';
import { heroHeight } from '@/theme/layout';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

export type HeroKind = 'continue' | 'recent';

/**
 * The full-bleed banner at the top of Home. Artwork runs edge to edge and up
 * under the status bar; the pinned header floats over its top scrim, and the
 * bottom gradient ends on `colors.background` so the frame melts into the grid
 * rather than stopping at a hard edge.
 *
 * `kind` is `continue` when there is something to resume and `recent` otherwise —
 * the layout is identical either way, which is what stops Home from jumping
 * between two completely different headers depending on watch state.
 */
export function HomeHero({
  video,
  kind,
  percent,
  onPlay,
  onOpenGroup,
}: {
  video: LibraryVideo;
  kind: HeroKind;
  percent: number;
  onPlay: () => void;
  /** Only set when the video belongs to a group with more than one item. */
  onOpenGroup?: () => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();

  const height = heroHeight(windowHeight, insets.top);
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);

  const remainingMs = video.durationMs ? video.durationMs * (1 - Math.min(percent, 1)) : 0;
  const overline =
    kind === 'continue'
      ? label
        ? `Continue · ${label}`
        : 'Continue watching'
      : label
        ? `Recently added · ${label}`
        : 'Recently added';
  const meta =
    kind === 'continue' && remainingMs > 0
      ? `${formatTime(remainingMs / 1000)} left`
      : video.durationMs
        ? formatTime(video.durationMs / 1000)
        : '';

  return (
    <View style={{ height }}>
      <Animated.View
        style={StyleSheet.absoluteFill}
        entering={reducedMotion ? undefined : FadeIn.duration(400)}>
        <VideoThumbnail video={video} style={StyleSheet.absoluteFill} width={THUMB_WIDTH_HERO} />
      </Animated.View>

      {/* Bottom scrim: darkens the lower half for text, then lands exactly on the
          page background so there is no visible seam against the grid. */}
      <Gradient
        style={StyleSheet.absoluteFill}
        stops={[
          { color: CLEAR, at: '28%' },
          { color: 'rgba(0,0,0,0.45)', at: '62%' },
          { color: 'rgba(0,0,0,0.75)', at: '82%' },
          { color: colors.background, at: '100%' },
        ]}
      />

      <View
        style={[
          styles.body,
          { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
        ]}>
        <AppText variant="episode" color={ON_ARTWORK.secondary} style={styles.overline}>
          {overline.toUpperCase()}
        </AppText>
        <AppText variant="headline" color={ON_ARTWORK.primary} numberOfLines={2}>
          {video.filename}
        </AppText>
        {meta ? (
          <AppText variant="meta" color={ON_ARTWORK.secondary}>
            {meta}
          </AppText>
        ) : null}
        {percent > 0 ? (
          <View style={{ marginTop: spacing.xs }}>
            <ProgressBar percent={percent} tone="artwork" height={4} />
          </View>
        ) : null}
        <View style={[styles.actions, { gap: spacing.sm, marginTop: spacing.md }]}>
          <PillButton
            label={kind === 'continue' ? 'Continue' : 'Play'}
            icon="play"
            onPress={onPlay}
            tone="filled"
          />
          {onOpenGroup ? (
            <PillButton label="Episodes" icon="albums-outline" onPress={onOpenGroup} tone="artwork" />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/**
 * Stand-in banner for when the library has nothing to show at all — no artwork
 * exists yet, so this keeps the same height and rhythm as the real hero instead
 * of collapsing the header.
 */
export function HomeHeroPlaceholder({ message, hint }: { message: string; hint?: string }) {
  const { colors, spacing, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  return (
    <View style={{ height: heroHeight(windowHeight, insets.top), backgroundColor: elevation(1) }}>
      <Gradient
        style={StyleSheet.absoluteFill}
        stops={[
          { color: CLEAR, at: '55%' },
          { color: colors.background, at: '100%' },
        ]}
      />
      <View style={[styles.body, { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs }]}>
        <AppText variant="headline" numberOfLines={2}>
          {message}
        </AppText>
        {hint ? (
          <AppText variant="body" color={colors.onSurfaceVariant ?? colors.onSurface}>
            {hint}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overline: { letterSpacing: 1.1 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
});
