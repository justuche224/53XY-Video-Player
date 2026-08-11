import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from './app-text';
import { IconButton } from './icon-button';
import { useTheme } from '@/theme/theme-provider';

export function EditGroupSheet({
  visible,
  defaultName = '',
  onClose,
  onSubmit,
}: {
  visible: boolean;
  defaultName?: string;
  onClose: () => void;
  onSubmit: (newName: string | null) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const [name, setName] = useState(defaultName);

  useEffect(() => {
    if (visible) setName(defaultName);
  }, [visible, defaultName]);

  const handleSave = () => {
    const trimmed = name.trim();
    onSubmit(trimmed || null);
    onClose();
  };

  const handleReset = () => {
    onSubmit(null); // passing null clears the manual group override
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1b1b1b',
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.lg,
            },
          ]}
          onPress={() => {}}>
          <View style={styles.header}>
            <AppText variant="headline" style={{ flex: 1 }}>Move to Group</AppText>
            <IconButton name="close" accessibilityLabel="Close" onPress={onClose} />
          </View>
          
          <AppText variant="body" style={{ color: colors.onSurfaceVariant, marginBottom: spacing.md }}>
            Enter a custom group name for the selected videos.
          </AppText>

          <TextInput
            style={[
              styles.input,
              { color: colors.onSurface, borderColor: colors.outline, marginBottom: spacing.md },
            ]}
            placeholder="Custom Group Name..."
            placeholderTextColor={colors.onSurfaceVariant}
            value={name}
            onChangeText={setName}
            autoFocus
            onSubmitEditing={handleSave}
          />
          
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Pressable
              style={[styles.button, { flex: 1, backgroundColor: colors.surfaceVariant }]}
              onPress={handleReset}>
              <AppText variant="body" style={{ color: colors.onSurface, fontWeight: '600' }}>
                Reset to Default
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.button, { flex: 1, backgroundColor: colors.primary }]}
              onPress={handleSave}>
              <AppText variant="body" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                Save
              </AppText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
});
