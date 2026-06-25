import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppBar } from '@/components/app-bar';
import { AppText } from '@/components/app-text';
import { CustomLengthDialog } from '@/components/custom-length-dialog';
import { FilterChips, type LengthPreset } from '@/components/filter-chips';
import { NamePatternList } from '@/components/name-pattern-list';
import { Screen } from '@/components/screen';
import { applyFilters } from '@/library/filter-videos';
import { useFilterSettings } from '@/library/filter-settings';
import { useAllVideos } from '@/library/use-all-videos';
import { useTheme } from '@/theme/theme-provider';

const MIN_PRESETS: LengthPreset[] = [
  { label: '10s', ms: 10_000 }, { label: '30s', ms: 30_000 },
  { label: '1m', ms: 60_000 }, { label: '5m', ms: 300_000 },
];
const MAX_PRESETS: LengthPreset[] = [
  { label: '1h', ms: 3_600_000 }, { label: '2h', ms: 7_200_000 }, { label: '3h', ms: 10_800_000 },
];

function LabelRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.labelRow}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceVariant ?? '#aaa'} />
      <AppText variant="titleSmall" color={colors.onSurfaceVariant ?? colors.onSurface}>{text}</AppText>
    </View>
  );
}

export default function LibraryFiltersScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const { filter, setMin, setMax, addNamePattern, removeNamePattern } = useFilterSettings();
  const [dialog, setDialog] = useState<'min' | 'max' | null>(null);
  const allVideos = useAllVideos();
  const hidden = allVideos.length - applyFilters(allVideos, filter).length;

  return (
    <Screen style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
      <AppBar title="Library filters" variant="detail" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl * 2 }} bounces overScrollMode="always">
        <LabelRow icon="time-outline" text="Hide videos shorter than" />
        <FilterChips presets={MIN_PRESETS} value={filter.minDurationMs} onSelect={setMin} onCustom={() => setDialog('min')} />
        <LabelRow icon="hourglass-outline" text="Hide videos longer than" />
        <FilterChips presets={MAX_PRESETS} value={filter.maxDurationMs} onSelect={setMax} onCustom={() => setDialog('max')} />
        <LabelRow icon="text-outline" text="Ignore videos named" />
        <NamePatternList patterns={filter.namePatterns} onAdd={addNamePattern} onRemove={removeNamePattern} />
        <AppText variant="meta" color={colors.onSurfaceVariant ?? colors.onSurface}>
          {hidden > 0 ? `Hiding ${hidden} video${hidden === 1 ? '' : 's'}` : 'No videos hidden'}
        </AppText>
      </ScrollView>
      <CustomLengthDialog
        visible={dialog !== null}
        initialMs={dialog === 'min' ? filter.minDurationMs : dialog === 'max' ? filter.maxDurationMs : null}
        onCancel={() => setDialog(null)}
        onConfirm={(ms) => {
          if (dialog === 'min') setMin(ms);
          else if (dialog === 'max') setMax(ms);
          setDialog(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
});
