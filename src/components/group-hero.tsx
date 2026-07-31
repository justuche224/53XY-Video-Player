import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';
import { CLEAR, Gradient } from './gradient';
import { PillButton } from './pill-button';
import { ThumbnailCollage } from './thumbnail-collage';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { Group, LibraryVideo } from '@/library/types';
import { formatTime } from '@/player/format-time';
import { groupHeroHeight } from '@/theme/layout';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

/**
 * Group detail's banner: the Home hero's little sibling. Collage artwork running
 * edge to edge under the status bar, bottom gradient landing on the page
 * background, group title + count/runtime over it, and a Continue pill when the
 * group has something in progress. The floating back button lives in the screen,
 * not here — it must stay pinned while this scrolls away.
 */
export function GroupHero({
  group,
  resume,
  onContinue,
}: {
  group: Group;
  /** Most recently played, still-existing video in this group, if any. */
  resume: LibraryVideo | null;
  onContinue: (video: LibraryVideo) => void;
}) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  const meta = [
    `${group.count} video${group.count === 1 ? '' : 's'}`,
    totalMs > 0 ? formatTime(totalMs / 1000) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const target = resume ?? group.items[0] ?? null;
  const { season, episode } = target ? parseEpisode(target.filename) : { season: null, episode: null };
  const label = formatEpisodeLabel(season, episode);
  const buttonLabel = resume ? (label ? `Continue ${label}` : 'Continue') : 'Play';

  return (
    <View style={{ height: groupHeroHeight(windowHeight, insets.top) }}>
      <ThumbnailCollage videos={group.items} style={StyleSheet.absoluteFill} />
      {/* Top scrim keeps the floating back button legible; bottom gradient melts
          the artwork into the list, same recipe as the Home hero. */}
      <Gradient
        style={styles.topScrim}
        stops={[
          { color: 'rgba(0,0,0,0.5)', at: '0%' },
          { color: CLEAR, at: '100%' },
        ]}
      />
      <Gradient
        style={StyleSheet.absoluteFill}
        stops={[
          { color: CLEAR, at: '30%' },
          { color: 'rgba(0,0,0,0.5)', at: '65%' },
          { color: colors.background, at: '100%' },
        ]}
      />
      <View style={[styles.body, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.xs }]}>
        <AppText variant="headline" color={ON_ARTWORK.primary} numberOfLines={2}>
          {group.title}
        </AppText>
        <AppText variant="meta" color={ON_ARTWORK.secondary}>
          {meta}
        </AppText>
        {target ? (
          <View style={[styles.actions, { marginTop: spacing.sm }]}>
            <PillButton label={buttonLabel} icon="play" onPress={() => onContinue(target)} tone="filled" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '38%' },
  body: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  actions: { flexDirection: 'row' },
});
