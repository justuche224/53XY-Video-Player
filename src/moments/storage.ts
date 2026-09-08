import { Directory, File, Paths } from 'expo-file-system';

import { fromManifestJson, toManifestJson } from './manifest';
import { MANIFEST_FILENAME } from './moment-policy';
import { pickMomentsDir } from './moments-dir';
import type { Moment } from './types';

/**
 * Resolved once per app run. The probe below touches the filesystem, and the
 * answer cannot change while the process lives.
 */
let cachedDir: string | null = null;

/**
 * True when the shared 53XY/Moments directory exists or can be created.
 * MANAGE_EXTERNAL_STORAGE is already granted for subtitle reading, so this
 * normally succeeds; it can still fail on an unusual device or if the user
 * revoked the permission, which is what the fallback is for.
 */
function sharedStorageWritable(dir: string): boolean {
  try {
    const directory = new Directory(dir);
    if (!directory.exists) directory.create({ intermediates: true });
    return directory.exists;
  } catch {
    return false;
  }
}

/**
 * Creates the moments directory and its `.nomedia`, and returns the directory
 * uri. `.nomedia` is what keeps saved frames out of the gallery and away from
 * the screenshots folder — the entire reason this feature exists.
 */
export function ensureMomentsDir(): string {
  if (cachedDir) return cachedDir;

  const shared = pickMomentsDir(true, Paths.document.uri);
  const dir = sharedStorageWritable(shared)
    ? shared
    : pickMomentsDir(false, Paths.document.uri);

  const directory = new Directory(dir);
  if (!directory.exists) directory.create({ intermediates: true });

  const nomedia = new File(directory, '.nomedia');
  if (!nomedia.exists) nomedia.create();

  cachedDir = dir;
  return dir;
}

export function writeManifest(dir: string, moments: Moment[]): void {
  const file = new File(new Directory(dir), MANIFEST_FILENAME);
  if (!file.exists) file.create();
  file.write(toManifestJson(moments));
}

/** Empty when the manifest is absent, unreadable, or unparseable. */
export function readManifest(dir: string): Moment[] {
  try {
    const file = new File(new Directory(dir), MANIFEST_FILENAME);
    if (!file.exists) return [];
    return fromManifestJson(file.textSync());
  } catch {
    return [];
  }
}

/** Best-effort: a frame that is already gone is not an error. */
export function deleteFrame(frameUri: string | null): void {
  if (!frameUri) return;
  try {
    const file = new File(frameUri);
    if (file.exists) file.delete();
  } catch {
    // A frame we cannot delete is a leaked file, not a failed user action.
  }
}
