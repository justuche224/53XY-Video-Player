import { memo } from 'react';
import { StyleSheet } from 'react-native';

import { MediaCard } from './media-card';
import { ThumbnailCollage } from './thumbnail-collage';
import type { Group } from '@/library/types';

export const GroupCard = memo(function GroupCard({
  group,
  percent,
  onPress,
  onLongPress,
  selected,
}: {
  group: Group;
  percent: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const totalMs = group.items.reduce((acc, v) => acc + (v.durationMs ?? 0), 0);
  return (
    <MediaCard
      thumbnail={<ThumbnailCollage videos={group.items} style={styles.fill} />}
      title={group.title}
      meta={`${group.count} video${group.count === 1 ? '' : 's'}`}
      percent={percent}
      durationMs={totalMs}
      onPress={onPress}
      onLongPress={onLongPress}
      selected={selected}
    />
  );
});

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
