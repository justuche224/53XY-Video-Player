// src/components/player/preview-frame-image.tsx
import { useState } from 'react';
import type { StyleProp } from 'react-native';
import { Image, type ImageStyle } from 'expo-image';

/**
 * Preview frame that vanishes instead of showing a black box when its cache
 * file has been evicted by the OS (the DB row can outlive the file). The
 * bubble then degrades to timestamp-only, per the spec's "never a misleading
 * frame" rule.
 */
export function PreviewFrameImage({ uri, style }: { uri: string; style: StyleProp<ImageStyle> }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (failedUri === uri) return null;
  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      onError={() => setFailedUri(uri)}
    />
  );
}
