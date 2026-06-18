import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/theme-provider';

export interface FolderEntry {
  path: string;
  name: string;
  count: number;
}

export function FolderIgnoreList({
  folders,
  ignoredFolders,
  onToggle,
}: {
  folders: FolderEntry[];
  ignoredFolders: string[];
  onToggle: (path: string) => void;
}) {
  const { colors } = useTheme();

  if (folders.length === 0) {
    return <Text style={{ color: colors.onSurfaceVariant ?? '#888' }}>No folders found.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {folders.map((f) => {
        const shown = !ignoredFolders.includes(f.path);
        return (
          <View key={f.path} style={styles.row}>
            <View style={styles.info}>
              <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>
                {f.name || 'Unknown'}
              </Text>
              <Text style={[styles.meta, { color: colors.onSurfaceVariant ?? '#888' }]} numberOfLines={1}>
                {f.count} video{f.count === 1 ? '' : 's'}
              </Text>
            </View>
            <Switch value={shown} onValueChange={() => onToggle(f.path)} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  info: { flex: 1, marginRight: 12 },
  name: { fontSize: 15, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 2 },
});
