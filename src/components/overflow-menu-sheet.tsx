import { Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from './app-text';
import { useTheme } from '@/theme/theme-provider';

export interface OverflowAction {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}

/**
 * Bottom sheet listing the contextual app bar's lower-frequency actions.
 * Same Modal + backdrop-Pressable + sheet-Pressable pattern as
 * `EditGroupSheet`/`AddToPlaylistSheet`, so it matches the rest of the app's
 * sheets visually and in dismiss behavior (tap backdrop or back button to
 * close).
 */
export function OverflowMenuSheet({
  visible,
  actions,
  onClose,
}: {
  visible: boolean;
  actions: OverflowAction[];
  onClose: () => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();

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
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm + insets.bottom,
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={() => {}}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={({ pressed }) => [
                styles.row,
                {
                  gap: spacing.md,
                  paddingVertical: spacing.md,
                  minHeight: 48,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                onClose();
                requestAnimationFrame(action.onPress);
              }}>
              <Ionicons name={action.icon} size={22} color={colors.onSurface} />
              <AppText variant="body">{action.label}</AppText>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
