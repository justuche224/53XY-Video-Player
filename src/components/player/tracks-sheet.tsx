// src/components/player/tracks-sheet.tsx
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import type { SubtitleTrack, AudioTrack } from 'expo-video';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

interface TracksSheetProps {
  player: VideoPlayer;
  subtitleTracks: SubtitleTrack[];
  audioTracks: AudioTrack[];
  activeSubtitle: SubtitleTrack | null;
  activeAudio: AudioTrack | null;
  onClose: () => void;
}

export function TracksSheet({
  player,
  subtitleTracks,
  audioTracks,
  activeSubtitle,
  activeAudio,
  onClose,
}: TracksSheetProps) {
  const { colors, spacing, radius } = useTheme();

  function handleSelectSubtitle(track: SubtitleTrack | null) {
    player.subtitleTrack = track;
    onClose();
  }

  function handleSelectAudio(track: AudioTrack) {
    player.audioTrack = track;
    onClose();
  }

  const hasSubtitles = subtitleTracks.length > 0;
  const hasAudio = audioTracks.length > 1; // Only show if multiple audio tracks

  if (!hasSubtitles && !hasAudio) {
    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface ?? '#1e1e1e',
                borderRadius: radius.lg,
                padding: spacing.lg,
                marginHorizontal: spacing.lg,
              },
            ]}>
            <Text style={[styles.noTracksText, { color: colors.onSurface }]}>
              No embedded tracks available
            </Text>
          </View>
        </Pressable>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1e1e1e',
              borderRadius: radius.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              marginHorizontal: spacing.md,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.outline ?? '#555' }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            {hasSubtitles && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant ?? '#aaa', marginHorizontal: spacing.lg }]}>
                  Subtitles
                </Text>

                {/* Off row */}
                <TrackRow
                  label="Off"
                  isActive={activeSubtitle === null}
                  onPress={() => handleSelectSubtitle(null)}
                  colors={colors}
                  spacing={spacing}
                />

                {subtitleTracks.map((track, i) => (
                  <TrackRow
                    key={track.id ?? `sub-${i}`}
                    label={track.label || track.language}
                    isActive={
                      activeSubtitle !== null &&
                      (track.id !== undefined
                        ? track.id === activeSubtitle.id
                        : track.language === activeSubtitle.language)
                    }
                    onPress={() => handleSelectSubtitle(track)}
                    colors={colors}
                    spacing={spacing}
                  />
                ))}
              </>
            )}

            {hasAudio && (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: colors.onSurfaceVariant ?? '#aaa',
                      marginHorizontal: spacing.lg,
                      marginTop: hasSubtitles ? spacing.md : 0,
                    },
                  ]}>
                  Audio
                </Text>

                {audioTracks.map((track, i) => (
                  <TrackRow
                    key={track.id ?? `audio-${i}`}
                    label={track.label || track.language}
                    isActive={
                      activeAudio !== null &&
                      (track.id !== undefined
                        ? track.id === activeAudio.id
                        : track.language === activeAudio.language)
                    }
                    onPress={() => handleSelectAudio(track)}
                    colors={colors}
                    spacing={spacing}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function TrackRow({
  label,
  isActive,
  onPress,
  colors,
  spacing,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  colors: Record<string, string>;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
}) {
  return (
    <PressableScale onPress={onPress} style={[styles.trackRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }]}>
      <Text
        style={[
          styles.trackLabel,
          {
            color: isActive ? (colors.primary ?? '#90caf9') : (colors.onSurface ?? '#fff'),
            fontWeight: isActive ? '600' : '400',
          },
        ]}>
        {label}
      </Text>
      {isActive && (
        <Text style={[styles.checkmark, { color: colors.primary ?? '#90caf9' }]}>{'✓'}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  trackLabel: {
    fontSize: 15,
  },
  checkmark: {
    fontSize: 16,
  },
  noTracksText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
