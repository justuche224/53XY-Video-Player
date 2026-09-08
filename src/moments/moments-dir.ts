import { MOMENTS_DIR_NAME, SHARED_MOMENTS_DIR } from './moment-policy';

function join(base: string, segment: string): string {
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmed}/${segment}`;
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
