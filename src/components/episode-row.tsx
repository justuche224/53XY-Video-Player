import { StyleSheet } from 'react-native';

import { MediaRow } from './media-row';
import { VideoThumbnail } from './video-thumbnail';
import { formatEpisodeLabel } from '@/library/episode-label';
import { parseEpisode } from '@/library/parse-episode';
import type { LibraryVideo } from '@/library/types';

export function EpisodeRow({
  video,
  percent,
  onPress,
  onLongPress,
  selected,
}: {
  video: LibraryVideo;
  percent: number;
  onPress?: () => void;
  onLongPress?: () => void;
  selected?: boolean;
}) {
  const { season, episode } = parseEpisode(video.filename);
  const label = formatEpisodeLabel(season, episode);
  return (
    <MediaRow
      thumbnail={<VideoThumbnail video={video} style={styles.fill} />}
      overline={label || undefined}
      title={video.filename}
      percent={percent}
      durationMs={video.durationMs}
      onPress={onPress}
      onLongPress={onLongPress}
      selected={selected}
    />
  );
}

const styles = StyleSheet.create({ fill: { width: '100%', height: '100%' } });
