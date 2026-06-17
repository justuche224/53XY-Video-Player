import { Image } from 'expo-image';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { getOrCreateThumbnail } from '@/media/thumbnails';
import type { LibraryVideo } from '@/library/types';
import { useTheme } from '@/theme/theme-provider';

export function VideoThumbnail({ video, style }: { video: LibraryVideo; style?: StyleProp<ViewStyle> }) {
  const { colors, radius } = useTheme();
  const [uri, setUri] = useState<string | null>(video.thumbUri);
  const db = useSQLiteContext();

  useEffect(() => {
    let cancelled = false;
    if (!uri) {
      getOrCreateThumbnail(db, video).then((u) => {
        if (!cancelled && u) setUri(u);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [db, video, uri]);

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
