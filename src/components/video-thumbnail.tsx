import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { getOrCreateThumbnail } from '@/media/thumbnails';
import { THUMB_WIDTH_CARD } from '@/media/thumb-policy';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function VideoThumbnail({
  video,
  style,
  width = THUMB_WIDTH_CARD,
  radius = 0,
}: {
  video: LibraryVideo;
  style?: StyleProp<ViewStyle>;
  width?: number;
  /**
   * Corner radius. Defaults to square: a thumbnail almost always sits inside a
   * clipping container (card poster, row thumb, collage cell) that already owns
   * the corner, and rounding here too meant two radii had to be kept manually in
   * sync — the double-rounding issue logged in HANDOFF §3. Only pass this when
   * the thumbnail is standalone.
   */
  radius?: number;
}) {
  const { colors } = useTheme();
  const db = useSQLiteContext();

  // Which video+size the held uri actually belongs to. Without this the resolved
  // uri outlives the prop that produced it: `useState` seeds only on first mount,
  // so a component that stays mounted while `video` changes underneath it — the
  // Home hero every time the resume target changes, or a recycled list row — keeps
  // showing the previous video's frame, and the `if (uri) return` guard below then
  // stops it ever regenerating.
  const key = `${video.id}@${width}`;
  const [resolved, setResolved] = useState<{ key: string; uri: string | null }>(() => ({
    key,
    // thumbUri from the library row is the card-sized file; other sizes start empty.
    uri: width === THUMB_WIDTH_CARD ? video.thumbUri : null,
  }));
  if (resolved.key !== key) {
    setResolved({ key, uri: width === THUMB_WIDTH_CARD ? video.thumbUri : null });
  }
  const uri = resolved.key === key ? resolved.uri : null;

  useEffect(() => {
    if (uri) return;
    let cancelled = false;
    // Schedule native frame extraction only when the JS thread is idle, so it
    // never competes with active scrolling. If the row scrolls out of the
    // window and unmounts before idle fires, cancelIdleCallback drops the work
    // entirely — so a fast flick never piles up generations for passed rows.
    const handle = requestIdleCallback(() => {
      getOrCreateThumbnail(db, video, width).then((u) => {
        // Guard on `key` as well as cancellation: an extraction started for a
        // previous video can still land after the prop changed.
        if (!cancelled && u) setResolved((prev) => (prev.key === key ? { key, uri: u } : prev));
      });
    });
    return () => {
      cancelled = true;
      cancelIdleCallback(handle);
    };
  }, [db, video, uri, width, key]);

  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceVariant ?? '#222',
          borderRadius: radius,
          overflow: 'hidden',
        },
        style,
      ]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          recyclingKey={video.id}
          cachePolicy="memory-disk"
        />
      ) : null}
    </View>
  );
}
