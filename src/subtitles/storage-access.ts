import * as Application from 'expo-application';
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
  // The REAL application id of the running process, not the one derived from
  // app.config.ts. The dev, preview and production variants install side by
  // side with different ids, and the JS config is not a reliable witness to
  // which one is running: the Metro server evaluates app.config.ts with
  // whatever APP_VARIANT it was started with, so a dev build served by a
  // plain `npx expo start` reports the production id. This previously
  // deep-linked users to the production app's All-files-access toggle, where
  // granting it did nothing for the build they were actually using.
  const pkg = Application.applicationId;
  if (!pkg) {
    // Without a package id a deep link would be a guess, and guessing wrong
    // sends the user to some other app's permission page. The global list is
    // one extra tap and always correct.
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION');
    return;
  }
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
