import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { msToParts, partsToMs, type LengthUnit } from '@/library/filter-videos';
import { useTheme } from '@/theme/theme-provider';

const UNITS: { key: LengthUnit; label: string }[] = [
  { key: 'sec', label: 'sec' },
  { key: 'min', label: 'min' },
  { key: 'hr', label: 'hr' },
];

export function CustomLengthDialog({
  visible,
  initialMs,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  initialMs: number | null;
  onCancel: () => void;
  onConfirm: (ms: number) => void;
}) {
  const { colors, radius, spacing } = useTheme();
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<LengthUnit>('min');

  // Prefill from the current value each time the dialog opens.
  useEffect(() => {
    if (!visible) return;
    if (initialMs != null) {
      const parts = msToParts(initialMs);
      setText(String(parts.value));
      setUnit(parts.unit);
    } else {
      setText('');
      setUnit('min');
    }
  }, [visible, initialMs]);

  const num = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(num) && num > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[styles.card, { backgroundColor: colors.surface ?? '#1b1b1b', borderRadius: radius.xl, padding: spacing.lg }]}
          onPress={() => {}}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Custom length</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
            style={[
              styles.input,
              { color: colors.onSurface, borderColor: colors.outline ?? '#555', borderRadius: radius.md },
            ]}
          />
          <View style={styles.unitRow}>
            {UNITS.map((u) => {
              const active = u.key === unit;
              return (
                <Pressable
                  key={u.key}
                  onPress={() => setUnit(u.key)}
                  style={[
                    styles.unitChip,
                    { borderRadius: radius.pill, backgroundColor: active ? colors.primary : colors.surfaceVariant ?? '#222' },
                  ]}>
                  <Text style={{ color: active ? colors.onPrimary ?? '#fff' : colors.onSurface, fontWeight: '600' }}>
                    {u.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.action}>
              <Text style={{ color: colors.onSurfaceVariant ?? '#aaa', fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!valid}
              onPress={() => onConfirm(partsToMs(num, unit))}
              style={styles.action}>
              <Text style={{ color: valid ? colors.primary : colors.outline ?? '#555', fontWeight: '700' }}>Set</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  unitRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  unitChip: { paddingHorizontal: 16, paddingVertical: 8 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  action: { paddingHorizontal: 16, paddingVertical: 8 },
});
