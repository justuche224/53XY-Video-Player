import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppBar } from '@/components/app-bar';
import { ListItem } from '@/components/list-item';
import { MomentNoteSheet } from '@/components/player/moment-note-sheet';
import { Screen } from '@/components/screen';
import { SettingsGroup } from '@/components/settings-group';
import {
  deleteMoments,
  getMoments,
  updateMomentNote,
  updateMomentVideoLink,
} from '@/db/moments-repo';
import { useLibraryData } from '@/library/library-provider';
import { resolveMomentTarget } from '@/moments/resolve-moment-video';
import { shareFiles } from '@/moments/share-moments';
import { deleteFrame, ensureMomentsDir, writeManifest } from '@/moments/storage';
import type { Moment } from '@/moments/types';
import { formatTime } from '@/player/format-time';
import { useTheme } from '@/theme/theme-provider';

export default function MomentScreen() {
  const { momentId } = useLocalSearchParams<{ momentId: string }>();
  const { colors, spacing, radius } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const { videos } = useLibraryData();

  const [moment, setMoment] = useState<Moment | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMoments(db)
      .then((all) => {
        if (!cancelled) setMoment(all.find((m) => m.id === momentId) ?? null);
      })
      .catch((e) => console.warn('[moments] failed to load moment:', e));
    return () => {
      cancelled = true;
    };
  }, [db, momentId]);

  const rewriteManifest = useCallback(async () => {
    try {
      writeManifest(ensureMomentsDir(), await getMoments(db));
    } catch (e) {
      console.warn('[moments] failed to rewrite manifest:', e);
    }
  }, [db]);

  const onPlay = useCallback(() => {
    if (!moment) return;
    const target = resolveMomentTarget(moment, videos);
    if (target.kind === 'missing') return;

    // A relinked moment heals itself, so the next play is an exact hit rather
    // than another filename search. Fired off without blocking navigation —
    // the user tapped Play, so play.
    if (target.kind === 'relinked') {
      updateMomentVideoLink(db, moment.id, target.video.id, target.video.uri)
        .then(rewriteManifest)
        .catch((e) => console.warn('[moments] failed to relink moment:', e));
    }

    router.push({
      pathname: '/player',
      params: {
        videoId: target.video.id,
        uri: target.video.uri,
        title: target.video.filename,
        startMs: String(moment.positionMs),
      },
    });
  }, [db, moment, rewriteManifest, router, videos]);

  const onSaveNote = useCallback(
    (note: string) => {
      if (!moment) return;
      const previousNote = moment.note;
      const trimmed = note.trim() || null;
      setMoment({ ...moment, note: trimmed });
      updateMomentNote(db, moment.id, trimmed)
        .then(rewriteManifest)
        .catch((e) => {
          console.warn('[moments] failed to save note:', e);
          // The optimistic update above is now wrong — the database still has
          // the old note. Roll local state back so the UI doesn't show a note
          // that silently reverts next time the moment is opened.
          setMoment((current) =>
            current && current.id === moment.id ? { ...current, note: previousNote } : current,
          );
          Alert.alert('Note not saved', 'Something went wrong saving your note. Please try again.');
        });
    },
    [db, moment, rewriteManifest],
  );

  const onDelete = useCallback(() => {
    if (!moment) return;
    Alert.alert('Delete moment', 'Delete this moment and its saved frame?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // Row first, then the file: if the database delete throws, the
          // frame survives and the row still resolves to it — a leaked JPEG
          // nothing references, invisible to the user. Deleting the frame
          // first risks the opposite: a row that outlives its file and
          // renders permanently broken. Do not reorder this.
          try {
            await deleteMoments(db, [moment.id]);
            deleteFrame(moment.frameUri);
            await rewriteManifest();
          } catch (e) {
            console.warn('[moments] failed to delete moment:', e);
          }
          router.back();
        },
      },
    ]);
  }, [db, moment, rewriteManifest, router]);

  if (!moment) {
    return (
      <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <AppBar title="Moment" variant="detail" onBack={() => router.back()} />
      </Screen>
    );
  }

  const target = resolveMomentTarget(moment, videos);
  const missing = target.kind === 'missing';

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title={moment.title} variant="detail" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {moment.frameUri ? (
          <Image
            source={{ uri: moment.frameUri }}
            style={[styles.frame, { borderRadius: radius.md }]}
            contentFit="contain"
            transition={120}
          />
        ) : (
          <View
            style={[
              styles.frame,
              styles.placeholder,
              { borderRadius: radius.md, backgroundColor: colors.surfaceVariant ?? '#222' },
            ]}>
            <Ionicons name="image-outline" size={40} color={colors.onSurfaceVariant ?? '#888'} />
          </View>
        )}

        <Text
          style={[
            styles.subtitle,
            { color: colors.onSurfaceVariant ?? '#888', marginTop: spacing.md },
          ]}>
          {[
            moment.episodeLabel,
            formatTime(moment.positionMs / 1000),
            new Date(moment.createdAt).toLocaleDateString(),
          ]
            .filter(Boolean)
            .join('  ·  ')}
        </Text>

        {moment.note ? (
          <Text style={[styles.note, { color: colors.onSurface, marginTop: spacing.sm }]}>
            {moment.note}
          </Text>
        ) : null}

        {missing && (
          <Text style={[styles.missing, { color: colors.error ?? '#f66', marginTop: spacing.sm }]}>
            File no longer on this device
          </Text>
        )}

        <View style={{ marginTop: spacing.lg }}>
          <SettingsGroup insetDividers={false}>
            <ListItem
              title="Play from here"
              subtitle={missing ? 'File no longer on this device' : undefined}
              onPress={missing ? undefined : onPlay}
            />
            <ListItem
              title={moment.note ? 'Edit note' : 'Add note'}
              onPress={() => setNoteOpen(true)}
            />
            <ListItem
              title="Share frame"
              onPress={moment.frameUri ? () => void shareFiles([moment.frameUri!]) : undefined}
            />
            <ListItem title="Delete moment" onPress={onDelete} />
          </SettingsGroup>
        </View>
      </ScrollView>

      {noteOpen && (
        <MomentNoteSheet
          initialNote={moment.note ?? ''}
          onSave={onSaveNote}
          onClose={() => setNoteOpen(false)}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  note: {
    fontSize: 15,
    lineHeight: 21,
  },
  missing: {
    fontSize: 13,
    fontWeight: '600',
  },
});
