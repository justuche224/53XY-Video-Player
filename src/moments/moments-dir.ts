import { MOMENTS_DIR_NAME, SHARED_MOMENTS_DIR } from './moment-policy';

/**
 * Strips a trailing slash so two directory uris that refer to the same
 * location compare equal no matter which one carries it. expo-file-system's
 * native `Directory.uri` getter always appends a trailing slash (see
 * `FileSystemDirectory.asString()` on Android), while a hand-written constant
 * like `SHARED_MOMENTS_DIR` does not — any `===` between "a uri we built" and
 * "a uri the native side handed back" must go through this first.
 */
export function normalizeDirUri(uri: string): string {
  return uri.endsWith('/') ? uri.slice(0, -1) : uri;
}

function join(base: string, segment: string): string {
  return `${normalizeDirUri(base)}/${segment}`;
}

/**
 * Where frames go. Shared storage is strongly preferred: it is what makes a
 * moment survive uninstall and Clear Data. The app document directory is the
 * fallback — not the cache directory, which Android evicts under storage
 * pressure, the exact failure `thumbnails.ts` documents.
 */
export function pickMomentsDir(externalWritable: boolean, documentDir: string): string {
  return externalWritable ? SHARED_MOMENTS_DIR : join(documentDir, MOMENTS_DIR_NAME);
}

export function frameFileName(id: string): string {
  return `${id}.jpg`;
}

export function framePath(dir: string, id: string): string {
  return join(dir, frameFileName(id));
}
