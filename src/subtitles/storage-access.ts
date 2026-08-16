import Constants from 'expo-constants';
import { Directory } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Whether we can actually read a folder's contents.
 *
 * There is no JS binding for Environment.isExternalStorageManager(), so
 * instead of adding native code we probe the real capability: listing the
 * folder throws when all-files access has not been granted. This tests what
 * we care about rather than a proxy for it. If a particular OEM ROM makes
 * this unreliable, the fallback is an isExternalStorageManager() binding in
 * the existing modules/share-media Kotlin module — that swap touches only
 * this file.
 */
export function canReadFolder(folderUri: string): boolean {
  try {
    new Directory(folderUri).list();
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the system screen holding the All files access toggle, deep-linked to
 * this app rather than the generic list.
 */
export async function openAllFilesAccessSettings(): Promise<void> {
  const pkg = Constants.expoConfig?.android?.package ?? 'com.jvstuche.fiftythreexy';
  try {
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
      { data: `package:${pkg}` },
    );
  } catch {
    // Some ROMs do not expose the per-app screen; fall back to the global list.
    await IntentLauncher.startActivityAsync(
      'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
    );
  }
}
