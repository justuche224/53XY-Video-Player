// src/components/player/tracks-sheet.tsx
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import type { SubtitleTrack, AudioTrack } from 'expo-video';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';
import { disambiguateLabels } from '@/player/disambiguate-labels';
import { formatDelay } from '@/subtitles/format-delay';
import type { UseSubtitles } from '@/subtitles/use-subtitles';

interface TracksSheetProps {
  player: VideoPlayer;
  subtitleTracks: SubtitleTrack[];
  audioTracks: AudioTrack[];
  activeSubtitle: SubtitleTrack | null;
  activeAudio: AudioTrack | null;
  subtitles: UseSubtitles;
  onAdjustDelay: () => void;
  onClose: () => void;
}

export function TracksSheet({
  player,
  subtitleTracks,
  audioTracks,
  activeSubtitle,
  activeAudio,
  subtitles,
  onAdjustDelay,
  onClose,
}: TracksSheetProps) {
  const { colors, spacing, radius } = useTheme();

  function handleSelectSubtitle(track: SubtitleTrack | null) {
    if (track !== null) subtitles.clearSubtitle();
    player.subtitleTrack = track;
    onClose();
  }

  function handleSelectAudio(track: AudioTrack) {
    player.audioTrack = track;
    onClose();
  }

  const hasSubtitles = subtitleTracks.length > 0;
  const hasAudio = audioTracks.length > 1; // Only show if multiple audio tracks

  // Containers routinely ship two streams both labelled "English" (full and
  // forced, or SDH). Numbering them is the difference between a choice and a
  // coin toss.
  const subtitleLabels = disambiguateLabels(
    subtitleTracks.map((t) => t.label || t.language),
  );
  const audioLabels = disambiguateLabels(audioTracks.map((t) => t.label || t.language));

  const pickedFileLabel =
    subtitles.active !== null && subtitles.active.relativePath === null
      ? subtitles.active.name
      : null;

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1e1e1e',
              borderRadius: radius.xl,
              paddingTop: spacing.lg,
              paddingBottom: spacing.xl,
              marginHorizontal: spacing.md,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.outline ?? '#555' }]} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.onSurfaceVariant ?? '#aaa', marginHorizontal: spacing.lg },
              ]}>
              External subtitles
            </Text>

            {/* Off leads the list and carries the tick when nothing external is
                loaded — the same shape as the embedded section below, so the
                two sections can be read at a glance as "which one is on". */}
            <TrackRow
              label="Off"
              isActive={subtitles.active === null}
              onPress={() => {
                subtitles.clearSubtitle();
                onClose();
              }}
              colors={colors}
              spacing={spacing}
            />

            {/* A file picked through the system picker has no relativePath, so
                it matches no candidate row and would otherwise leave the whole
                section looking inert while its subtitles are on screen. Give it
                a row of its own. It is display-only: selecting the thing that
                is already selected does nothing. */}
            {pickedFileLabel !== null && (
              <TrackRow label={pickedFileLabel} isActive colors={colors} spacing={spacing} />
            )}

            {subtitles.candidates.map((candidate) => (
              <TrackRow
                key={candidate.relativePath}
                /* relativePath, not name: 'Movie.en.srt' and 'Subs/Movie.en.srt'
                   share a basename, and the path is what tells them apart. */
                label={candidate.relativePath}
                isActive={
                  subtitles.active?.relativePath != null &&
                  subtitles.active.relativePath === candidate.relativePath
                }
                onPress={() => {
                  void subtitles.selectCandidate(candidate);
                  onClose();
                }}
                colors={colors}
                spacing={spacing}
              />
            ))}

            {subtitles.needsPermission && (
              <TrackRow
                label="Allow access to subtitle files…"
                isActive={false}
                onPress={() => {
                  void subtitles.requestAccess();
                  onClose();
                }}
                colors={colors}
                spacing={spacing}
              />
            )}

            <TrackRow
              label="Load from file…"
              isActive={false}
              onPress={() => {
                void subtitles.pickFromFile();
                onClose();
              }}
              colors={colors}
              spacing={spacing}
            />

            {subtitles.active && (
              <TrackRow
                /* The current offset rides on the label so the sheet answers
                   "is it shifted, and by how much" without opening the bar. */
                label={
                  subtitles.delayMs === 0
                    ? 'Adjust delay…'
                    : `Adjust delay… (${formatDelay(subtitles.delayMs)})`
                }
                isActive={false}
                onPress={() => {
                  onAdjustDelay();
                  onClose();
                }}
                colors={colors}
                spacing={spacing}
              />
            )}

            {hasSubtitles && (
              <>
                {/* "Subtitles" alone read as the master switch, so its Off row
                    looked like it contradicted the external subtitles actually
                    on screen. Naming the source removes the contradiction. */}
                <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant ?? '#aaa', marginHorizontal: spacing.lg, marginTop: spacing.md }]}>
                  Embedded subtitles
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
                    label={subtitleLabels[i]}
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
                    label={audioLabels[i]}
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
  isActive?: boolean;
  /** Omit for a display-only row: it renders as a plain View, so it neither
      scales under a finger nor advertises a tap that does nothing. */
  onPress?: () => void;
  colors: Record<string, string>;
  spacing: { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
}) {
  const rowStyle = [styles.trackRow, { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }];
  const content = (
    <>
      <Text
        style={[
          styles.trackLabel,
          {
            color: isActive ? (colors.primary ?? '#90caf9') : (colors.onSurface ?? '#fff'),
            fontWeight: isActive ? '600' : '400',
          },
        ]}
        numberOfLines={1}
        ellipsizeMode="middle">
        {label}
      </Text>
      {isActive && (
        <Text style={[styles.checkmark, { color: colors.primary ?? '#90caf9' }]}>{'✓'}</Text>
      )}
    </>
  );

  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <PressableScale onPress={onPress} style={rowStyle}>
      {content}
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
    flexShrink: 1,
    marginRight: 8,
  },
  checkmark: {
    fontSize: 16,
  },
});
