import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

export function StorageAccessSheet({
  onGrant,
  onClose,
}: {
  onGrant: () => void;
  onClose: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface ?? '#1e1e1e',
              borderRadius: radius.xl,
              padding: spacing.lg,
              marginHorizontal: spacing.lg,
              gap: spacing.md,
            },
          ]}>
          <MaterialIcons name="folder-open" size={28} color={colors.primary ?? '#90caf9'} />
          <AppText variant="title" style={{ color: colors.onSurface }}>
            Allow access to subtitle files
          </AppText>
          <AppText variant="body" style={{ color: colors.onSurfaceVariant }}>
            Android treats subtitle files as non-media files, so 53XY needs All files access to
            read the .srt sitting next to your video. It is used only to read subtitle files.
          </AppText>
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <PressableScale onPress={onClose} style={[styles.action, { paddingHorizontal: spacing.md }]}>
              <AppText variant="label" style={{ color: colors.onSurfaceVariant }}>
                Not now
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={onGrant}
              style={[
                styles.action,
                {
                  paddingHorizontal: spacing.lg,
                  borderRadius: radius.pill,
                  backgroundColor: colors.primary ?? '#90caf9',
                },
              ]}>
              <AppText variant="label" style={{ color: colors.onPrimary ?? '#000' }}>
                Open settings
              </AppText>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
  sheet: { alignItems: 'flex-start' },
  actions: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center' },
  action: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
});
