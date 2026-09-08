// src/components/player/moment-note-sheet.tsx
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

interface MomentNoteSheetProps {
  /** Seeded from the subtitle line showing at capture; may be ''. */
  initialNote: string;
  onSave: (note: string) => void;
  onClose: () => void;
}

export function MomentNoteSheet({ initialNote, onSave, onClose }: MomentNoteSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const [note, setNote] = useState(initialNote);

  function save() {
    onSave(note);
    onClose();
  }

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
              paddingHorizontal: spacing.lg,
              marginHorizontal: spacing.md,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.outline ?? '#555' }]} />
          <Text style={[styles.header, { color: colors.onSurface }]}>Note</Text>

          <TextInput
            value={note}
            onChangeText={setNote}
            autoFocus
            multiline
            placeholder="What happens here?"
            placeholderTextColor={colors.onSurfaceVariant ?? '#999'}
            style={[
              styles.input,
              {
                color: colors.onSurface,
                backgroundColor: colors.surfaceVariant ?? 'rgba(255,255,255,0.06)',
                borderRadius: radius.md,
                padding: spacing.md,
                marginTop: spacing.sm,
              },
            ]}
          />

          <View style={[styles.actions, { marginTop: spacing.lg }]}>
            <PressableScale onPress={onClose}>
              <Text style={[styles.action, { color: colors.onSurfaceVariant ?? '#999' }]}>
                Cancel
              </Text>
            </PressableScale>
            <PressableScale onPress={save}>
              <Text style={[styles.action, { color: colors.primary, marginLeft: 24 }]}>Save</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    marginBottom: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  header: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 96,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  action: {
    fontSize: 15,
    fontWeight: '700',
  },
});
