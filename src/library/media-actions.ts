import * as MediaLibrary from 'expo-media-library';
import { Alert, ToastAndroid } from 'react-native';

import { ShareMedia } from '@/native/share-media';
import { resolveShare, SHARE_CAP } from './share-policy';

/**
 * Share videos by asset id. On Android those ids are already MediaStore
 * content:// URIs, which is exactly what the share intent wants.
 */
export function shareVideos(ids: string[]) {
  const decision = resolveShare(ids);
  if (decision.kind === 'empty') return;

  if (decision.kind === 'too-many') {
    Alert.alert(
      'Too many to share',
      `Sharing is limited to ${SHARE_CAP} videos at a time — you selected ${decision.count}.`,
    );
    return;
  }

  try {
    ShareMedia.shareMedia(decision.ids, 'Share videos');
  } catch (err) {
    console.error('Failed to share videos:', err);
    Alert.alert('Error', 'Could not open the share sheet.');
  }
}

export async function deleteVideos(
  ids: string[],
  onSuccess: () => void,
) {
  if (ids.length === 0) return;

  Alert.alert(
    'Delete permanently',
    `Are you sure you want to permanently delete ${ids.length} item${ids.length === 1 ? '' : 's'} from your device?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { granted } = await MediaLibrary.requestPermissionsAsync();
            if (!granted) {
              Alert.alert('Permission required', 'Need permission to delete files.');
              return;
            }

            // expo-media-library's new class-based API handles deletion
            const assets = ids.map(id => new MediaLibrary.Asset(id));
            await MediaLibrary.Asset.delete(assets);
            
            ToastAndroid.show(`Deleted ${ids.length} item${ids.length === 1 ? '' : 's'}`, ToastAndroid.SHORT);
            onSuccess();
          } catch (e) {
            console.error('Failed to delete videos:', e);
            Alert.alert('Error', 'Failed to delete videos.');
          }
        },
      },
    ]
  );
}
