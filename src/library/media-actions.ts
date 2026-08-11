import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Alert, ToastAndroid } from 'react-native';

export async function shareVideos(uris: string[]) {
  if (uris.length === 0) return;

  if (uris.length > 1) {
    Alert.alert(
      'Sharing limit',
      'Currently, only 1 file can be shared at a time.',
    );
    return;
  }

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Error', 'Sharing is not available on this device.');
    return;
  }

  try {
    await Sharing.shareAsync(uris[0]);
  } catch (err) {
    console.error('Failed to share video:', err);
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
