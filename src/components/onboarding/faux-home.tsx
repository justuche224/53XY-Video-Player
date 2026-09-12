// Facsimiles of the Home screen's parts, laid out at `DESIGN_WIDTH` for the
// onboarding phone frame. These deliberately do not import the real
// `HomeHero` / `MediaCard`: those pull SQLite and native thumbnail extraction
// for the rows they draw, which fake data would only trip over. The dimensions,
// tokens and type variants below are copied from the real components so the
// facsimile is the app, not an impression of it.
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Gradient } from '@/components/gradient';
import { STILLS, type StillKey } from '@/components/onboarding/stills';
import { ON_ARTWORK } from '@/theme/resolve-theme';
import { useTheme } from '@/theme/theme-provider';

const CLEAR = 'rgba(0,0,0,0)';
type IoniconName = keyof typeof Ionicons.glyphMap;

/** `artwork` = white on the hero scrim; `surface` = the pinned solid header. */
export type FauxTone = 'artwork' | 'surface';

export function FauxStatusBar({ tone }: { tone: FauxTone }) {
  const { colors, spacing } = useTheme();
  const fg = tone === 'artwork' ? ON_ARTWORK.primary : colors.onSurface;
  return (
    <View style={[styles.row, { height: 28, paddingHorizontal: spacing.lg + 4, justifyContent: 'space-between' }]}>
      <AppText variant="meta" color={fg}>
        10:24
      </AppText>
      <View style={[styles.row, { gap: 4 }]}>
        <Ionicons name="wifi" size={12} color={fg} />
        <Ionicons name="cellular" size={12} color={fg} />
        <Ionicons name="battery-full" size={14} color={fg} />
      </View>
    </View>
  );
}

/** The Home header: wordmark, the three actions, and the Videos/Folders tabs. */
export function FauxHomeHeader({ tone }: { tone: FauxTone }) {
  const { colors, spacing, radius, icon, isDark } = useTheme();
  const onArtwork = tone === 'artwork';
  // Same colour logic as `Wordmark`: tone-80 accent over artwork, `primary` on
  // the page.
  const base = onArtwork ? ON_ARTWORK.primary : colors.onSurface;
  const accent = onArtwork
    ? ((isDark ? colors.primary : colors.inversePrimary) ?? ON_ARTWORK.primary)
    : (colors.primary ?? colors.onSurface);
  const chip = onArtwork ? ON_ARTWORK.chip : (colors.surfaceContainerHigh ?? colors.surfaceVariant);
  const chipFg = onArtwork ? ON_ARTWORK.primary : (colors.onSurfaceVariant ?? colors.onSurface);
  const ACTIONS: IoniconName[] = ['search', 'swap-vertical', 'list-outline'];

  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
      <View style={[styles.row, { gap: spacing.sm, minHeight: 48 }]}>
        <View style={styles.row}>
          <AppText variant="display" color={base} style={styles.mark}>
            53
          </AppText>
          <AppText variant="display" color={accent} style={styles.mark}>
            XY
          </AppText>
        </View>
        <View style={{ flex: 1 }} />
        {ACTIONS.map((name) => (
          <View
            key={name}
            style={{
              width: 40,
              height: 40,
              borderRadius: radius.pill,
              backgroundColor: chip,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={name} size={icon.md} color={chipFg} />
          </View>
        ))}
      </View>
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.md }}>
        <View
          style={[
            styles.row,
            { padding: 4, alignSelf: 'flex-start', borderRadius: radius.pill, backgroundColor: chip },
          ]}
        >
          <View style={[styles.tab, { borderRadius: radius.pill, backgroundColor: colors.primary }]}>
            <AppText variant="label" color={colors.onPrimary ?? '#fff'}>
              Videos
            </AppText>
          </View>
          <View style={styles.tab}>
            <AppText variant="label" color={onArtwork ? ON_ARTWORK.secondary : chipFg}>
              Folders
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

/** A progress bar whose fill is a shared value, so a slide can animate it. */
export function FauxProgress({
  percent,
  tone,
  height = 3,
}: {
  percent: SharedValue<number>;
  tone: FauxTone;
  height?: number;
}) {
  const { colors, radius } = useTheme();
  const track = tone === 'artwork' ? ON_ARTWORK.track : (colors.surfaceVariant ?? '#333');
  const fill = tone === 'artwork' ? ON_ARTWORK.primary : colors.primary;
  const bar = useAnimatedStyle(() => ({ width: `${Math.min(100, percent.get() * 100)}%` }));
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[bar, { height, borderRadius: radius.pill, backgroundColor: fill }]} />
    </View>
  );
}

/**
 * The continue-watching banner, status bar and header included — on Home the
 * hero draws under both. Fixed 300 tall: the real one is a fraction of the
 * window, but the frame is already scaled, so a fraction of 760 would be a
 * lie about proportions.
 */
export function FauxHero({
  still,
  overline,
  title,
  meta,
  percent,
}: {
  still: StillKey;
  overline: string;
  title: string;
  meta: string;
  percent?: SharedValue<number>;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={{ height: 300 }}>
      <Image source={STILLS[still]} style={StyleSheet.absoluteFill} contentFit="cover" />
      <Gradient
        style={StyleSheet.absoluteFill}
        stops={[
          { color: 'rgba(0,0,0,0.62)', at: '0%' },
          { color: 'rgba(0,0,0,0.34)', at: '30%' },
          { color: CLEAR, at: '42%' },
          { color: 'rgba(0,0,0,0.45)', at: '62%' },
          { color: 'rgba(0,0,0,0.75)', at: '82%' },
          { color: colors.background, at: '100%' },
        ]}
      />
      <FauxStatusBar tone="artwork" />
      <FauxHomeHeader tone="artwork" />

      <View style={[styles.heroBody, { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs }]}>
        <AppText variant="episode" color={ON_ARTWORK.secondary} style={styles.overline}>
          {overline.toUpperCase()}
        </AppText>
        <AppText variant="headline" color={ON_ARTWORK.primary} numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" color={ON_ARTWORK.secondary}>
          {meta}
        </AppText>
        {percent ? (
          <View style={{ marginTop: spacing.xs }}>
            <FauxProgress percent={percent} tone="artwork" height={4} />
          </View>
        ) : null}
        <View style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}>
          <View style={[styles.pill, { borderRadius: radius.pill, backgroundColor: colors.primary }]}>
            <Ionicons name="play" size={18} color={colors.onPrimary ?? '#fff'} />
            <AppText variant="label" color={colors.onPrimary ?? '#fff'}>
              Continue
            </AppText>
          </View>
          <View style={[styles.pill, { borderRadius: radius.pill, backgroundColor: ON_ARTWORK.tonal }]}>
            <Ionicons name="albums-outline" size={18} color={ON_ARTWORK.primary} />
            <AppText variant="label" color={ON_ARTWORK.primary}>
              Episodes
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

export interface FauxCardData {
  key: string;
  title: string;
  meta: string;
  /** One still for a single video; three for a series card's collage. */
  stills: StillKey[];
  duration?: string;
  percent?: number;
}

/** One grid card — `MediaCard` with a still where the thumbnail would be. */
export function FauxCard({ card }: { card: FauxCardData }) {
  const { colors, spacing, radius, elevation, shadow } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        margin: spacing.sm,
        padding: spacing.xs + 2,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: elevation(2),
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.outlineVariant ?? 'transparent',
        boxShadow: shadow(1),
      }}
    >
      <View
        style={[
          styles.poster,
          { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' },
        ]}
      >
        {card.stills.length > 1 ? (
          // The real group card's collage: the first still takes the left half,
          // the next two stack on the right.
          <View style={[styles.row, StyleSheet.absoluteFill]}>
            <Image source={STILLS[card.stills[0]]} style={{ width: '50%', height: '100%' }} contentFit="cover" />
            <View style={{ width: '50%', height: '100%' }}>
              <Image source={STILLS[card.stills[1]]} style={{ width: '100%', height: '50%' }} contentFit="cover" />
              <Image source={STILLS[card.stills[2] ?? card.stills[1]]} style={{ width: '100%', height: '50%' }} contentFit="cover" />
            </View>
          </View>
        ) : (
          <Image source={STILLS[card.stills[0]]} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
        <Gradient style={styles.posterScrim} stops={[{ color: CLEAR, at: '0%' }, { color: 'rgba(0,0,0,0.55)', at: '100%' }]} />
        {card.duration ? (
          <View style={[styles.badge, { borderRadius: radius.pill }]}>
            <AppText variant="meta" color={ON_ARTWORK.primary} style={{ lineHeight: 14 }}>
              {card.duration}
            </AppText>
          </View>
        ) : null}
        {card.percent ? (
          <View style={[styles.progress, { height: 3, backgroundColor: ON_ARTWORK.track }]}>
            <View style={{ height: 3, width: `${card.percent * 100}%`, backgroundColor: ON_ARTWORK.primary }} />
          </View>
        ) : null}
      </View>
      <View style={{ paddingHorizontal: spacing.xs, paddingTop: spacing.sm, paddingBottom: spacing.xs, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>
          {card.title}
        </AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface} numberOfLines={1}>
          {card.meta}
        </AppText>
      </View>
    </View>
  );
}

/** Two-up grid rows with the Home grid's gutter. */
export function FauxGrid({ cards }: { cards: FauxCardData[] }) {
  const { spacing } = useTheme();
  const rows: FauxCardData[][] = [];
  for (let i = 0; i < cards.length; i += 2) rows.push(cards.slice(i, i + 2));
  return (
    <View style={{ paddingHorizontal: spacing.sm }}>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.row}>
          {row.map((card) => (
            <FauxCard key={card.key} card={card} />
          ))}
          {row.length === 1 ? <View style={{ flex: 1, margin: spacing.sm }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A watch-history row: thumbnail, title, when, and how far in. */
export function FauxHistoryRow({
  still,
  title,
  meta,
  percent,
}: {
  still: StillKey;
  title: string;
  meta: string;
  percent: number;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View style={[styles.row, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.md }]}>
      <View style={{ width: 96, aspectRatio: 16 / 10, borderRadius: radius.sm, overflow: 'hidden' }}>
        <Image source={STILLS[still]} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View style={[styles.progress, { height: 3, backgroundColor: ON_ARTWORK.track }]}>
          <View style={{ height: 3, width: `${percent * 100}%`, backgroundColor: ON_ARTWORK.primary }} />
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {meta}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { letterSpacing: -0.5 },
  tab: { paddingHorizontal: 18, paddingVertical: 7 },
  heroBody: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overline: { letterSpacing: 1.1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: 20,
  },
  poster: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden' },
  posterScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  badge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  progress: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
