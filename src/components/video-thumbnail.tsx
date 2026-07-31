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
}: {
  video: LibraryVideo;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  const { colors, radius } = useTheme();
  // thumbUri from the library row is the card-sized file; other sizes start empty.
  const [uri, setUri] = useState<string | null>(
    width === THUMB_WIDTH_CARD ? video.thumbUri : null,
  );
  const db = useSQLiteContext();

  useEffect(() => {
    if (uri) return;
    let cancelled = false;
    // Schedule native frame extraction only when the JS thread is idle, so it
    // never competes with active scrolling. If the row scrolls out of the
    // window and unmounts before idle fires, cancelIdleCallback drops the work
    // entirely — so a fast flick never piles up generations for passed rows.
    const handle = requestIdleCallback(() => {
      getOrCreateThumbnail(db, video, width).then((u) => {
        if (!cancelled && u) setUri(u);
      });
    });
    return () => {
      cancelled = true;
      cancelIdleCallback(handle);
    };
  }, [db, video, uri, width]);

  return (
    <View style={[{ backgroundColor: colors.surfaceVariant ?? '#222', borderRadius: radius.md, overflow: 'hidden' }, style]}>
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
