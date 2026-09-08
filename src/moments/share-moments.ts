import * as Sharing from 'expo-sharing';

/**
 * Share saved frames. expo-sharing takes one file at a time, so a
 * multi-selection shares the first frame — enough for "show someone this
 * scene", and honest about the API rather than silently dropping the rest.
 */
export async function shareFiles(uris: string[]): Promise<void> {
  const [first] = uris;
  if (!first) return;
  try {
    if (!(await Sharing.isAvailableAsync())) return;
    await Sharing.shareAsync(first, { mimeType: 'image/jpeg' });
  } catch (e) {
    console.warn('[moments] failed to share frame:', e);
  }
}
