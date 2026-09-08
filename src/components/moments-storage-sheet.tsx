import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { useTheme } from '@/theme/theme-provider';

export function MomentsStorageSheet({
  onOpenSettings,
  onDismiss,
}: {
  onOpenSettings: () => void;
  onDismiss: () => void;
}) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Modal transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
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
            Keep this moment safe
          </AppText>
          <AppText variant="body" style={{ color: colors.onSurfaceVariant }}>
            Moments are being saved inside 53XY, so uninstalling the app or clearing its data will
            delete them. Granting All files access lets them live in 53XY/Moments on internal
            storage instead — still hidden from your gallery.
          </AppText>
          <View style={[styles.actions, { gap: spacing.sm }]}>
            <PressableScale onPress={onDismiss} style={[styles.action, { paddingHorizontal: spacing.md }]}>
              <AppText variant="label" style={{ color: colors.onSurfaceVariant }}>
                Not now
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={onOpenSettings}
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
