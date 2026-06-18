import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export function NamePatternList({
  patterns,
  onAdd,
  onRemove,
}: {
  patterns: string[];
  onAdd: (pattern: string) => void;
  onRemove: (pattern: string) => void;
}) {
  const { colors, radius } = useTheme();
  const [text, setText] = useState('');

  const submit = () => {
    const p = text.trim();
    if (p === '') return;
    onAdd(p);
    setText('');
  };

  return (
    <View style={styles.wrap}>
      {patterns.map((p) => (
        <View
          key={p}
          style={[styles.row, { backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.pill }]}>
          <Text style={[styles.rowText, { color: colors.onSurface }]} numberOfLines={1}>
            {p}
          </Text>
          <Pressable onPress={() => onRemove(p)} hitSlop={8} style={styles.remove}>
            <Text style={{ color: colors.onSurfaceVariant ?? '#aaa', fontSize: 16, fontWeight: '700' }}>✕</Text>
          </Pressable>
        </View>
      ))}
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={submit}
          placeholder="Add pattern…"
          placeholderTextColor={colors.onSurfaceVariant ?? '#888'}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: colors.onSurface, borderColor: colors.outline ?? '#555', borderRadius: radius.md },
          ]}
        />
        <Pressable onPress={submit} style={[styles.addBtn, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
          <Text style={{ color: colors.onPrimary ?? '#fff', fontWeight: '700' }}>Add</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.onSurfaceVariant ?? '#888' }]}>
        Matches part of a name, or use * and ? wildcards — e.g. trailer, VID_*, *.gif
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8, paddingVertical: 6 },
  rowText: { flex: 1, fontWeight: '600' },
  remove: { paddingHorizontal: 8, paddingVertical: 2 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15 },
  addBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  hint: { fontSize: 12, marginTop: 2 },
});
