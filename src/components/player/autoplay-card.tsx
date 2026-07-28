// src/components/player/autoplay-card.tsx
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';

import { useTheme } from '@/theme/theme-provider';
import { PlayerPressableScale } from './player-pressable-scale';

interface AutoplayCardProps {
  title: string;
  /** Episode label ("S04E05") or '' when the filename carries no episode info. */
  episodeLabel: string;
  thumbUri: string | null;
  countdownSec: number;
  onCancel: () => void;
  onPlayNow: () => void;
}

export function AutoplayCard({
  title,
  episodeLabel,
  thumbUri,
  countdownSec,
  onCancel,
  onPlayNow,
}: AutoplayCardProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.inverseSurface ?? 'rgba(30,30,30,0.94)',
          borderRadius: radius.lg,
          padding: spacing.md,
          marginHorizontal: spacing.lg,
        },
      ]}>
      <View style={styles.topRow}>
        {thumbUri ? (
          <Image source={{ uri: thumbUri }} style={[styles.thumb, { borderRadius: radius.sm }]} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback, { borderRadius: radius.sm }]}>
            <MaterialIcons name="movie" size={20} color="#999" />
          </View>
        )}
        <View style={styles.meta}>
          <Text style={[styles.upNext, { color: colors.inverseOnSurface ?? '#fff' }]}>
            Up next{episodeLabel ? ` · ${episodeLabel}` : ''}
          </Text>
          <Text numberOfLines={1} style={[styles.title, { color: colors.inverseOnSurface ?? '#fff' }]}>
            {title}
          </Text>
          <Text style={[styles.countdown, { color: colors.inverseOnSurface ?? '#fff' }]}>
            Playing in {countdownSec}…
          </Text>
        </View>
      </View>
      <View style={[styles.buttonRow, { gap: spacing.sm }]}>
        <PlayerPressableScale onPress={onCancel} style={styles.button}>
          <Text style={[styles.buttonLabel, { color: colors.inverseOnSurface ?? '#fff' }]}>Cancel</Text>
        </PlayerPressableScale>
        <PlayerPressableScale
          onPress={onPlayNow}
          style={[styles.button, styles.playButton, { borderRadius: radius.pill }]}>
          <Text style={[styles.buttonLabel, styles.playLabel]}>Play now</Text>
        </PlayerPressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    minWidth: 280,
    maxWidth: 420,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 84,
    height: 47,
  },
  thumbFallback: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  upNext: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
  },
  countdown: {
    fontSize: 13,
    opacity: 0.85,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  playButton: {
    backgroundColor: '#fff',
  },
  buttonLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  playLabel: {
    color: '#000',
  },
});
