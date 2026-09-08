import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PressableScale } from '@/components/pressable-scale';
import type { Moment } from '@/moments/types';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

interface MomentCardProps {
  moment: Moment;
  /** Multi-select state; draws the selection ring. */
  selected?: boolean;
  /** The source file is no longer on the device — the card dims but still reads. */
  missing?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export function MomentCard({ moment, selected, missing, onPress, onLongPress }: MomentCardProps) {
  const { colors, radius, spacing } = useTheme();

  return (
    <PressableScale onPress={onPress} onLongPress={onLongPress} style={styles.container}>
      <View
        style={[
          styles.frame,
          {
            borderRadius: radius.md,
            backgroundColor: colors.surfaceVariant ?? 'rgba(255,255,255,0.06)',
            borderWidth: selected ? 2 : 0,
            borderColor: colors.primary,
          },
        ]}>
        {moment.frameUri ? (
          <Image
            source={{ uri: moment.frameUri }}
            style={[styles.image, { opacity: missing ? 0.45 : 1 }]}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={[styles.image, styles.placeholder]}>
            <Ionicons name="image-outline" size={28} color={colors.onSurfaceVariant ?? '#888'} />
          </View>
        )}

        <View style={[styles.badge, { borderRadius: radius.sm }]}>
          <Text style={styles.badgeText}>{formatTime(moment.positionMs / 1000)}</Text>
        </View>

        {missing && (
          <View style={[styles.missingBadge, { borderRadius: radius.sm }]}>
            <Ionicons name="alert-circle" size={12} color="#fff" />
          </View>
        )}
      </View>

      <Text
        numberOfLines={1}
        style={[styles.episode, { color: colors.onSurface, marginTop: spacing.xs }]}>
        {moment.episodeLabel ?? moment.title}
      </Text>
      {moment.note ? (
        <Text numberOfLines={2} style={[styles.note, { color: colors.onSurfaceVariant ?? '#888' }]}>
          {moment.note}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  frame: {
    aspectRatio: 16 / 9,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  missingBadge: {
    position: 'absolute',
    left: 6,
    top: 6,
    padding: 3,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  episode: {
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    fontSize: 12,
    marginTop: 2,
  },
});
