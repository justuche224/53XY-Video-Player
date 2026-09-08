import { Directory, File, Paths } from 'expo-file-system';

import { fromManifestJson, toManifestJson } from './manifest';
import type { MomentMove } from './migrate-moments';
import { MANIFEST_FILENAME, SHARED_MOMENTS_DIR } from './moment-policy';
import { pickMomentsDir } from './moments-dir';
import type { Moment } from './types';

/**
 * Resolved once per app run. The probe below touches the filesystem, and the
 * answer cannot change while the process lives.
 */
let cachedDir: string | null = null;

/** The always-present volume root that the shared Moments path hangs off. */
const EXTERNAL_STORAGE_ROOT = 'file:///storage/emulated/0';

/**
 * Creates `name` under `parent` if it isn't already there, and returns the
 * child directory either way.
 *
 * expo-file-system decides Android permission for a path outside the app
 * sandbox by calling `java.io.File(path).canRead()/canWrite()` — which is
 * false for a path that does not exist yet, and `MANAGE_EXTERNAL_STORAGE`
 * does not change that. So calling `.create()`/`.exists` on the not-yet-
 * created child itself always fails; creating it through the PARENT (which
 * does exist) is what actually works, including on a fresh install where
 * none of this exists yet.
 */
function ensureChildDirectory(parent: Directory, name: string): Directory {
  const child = new Directory(parent, name);
  return child.exists ? child : parent.createDirectory(name);
}

/** Same reasoning as `ensureChildDirectory`, for a file instead of a directory. */
function ensureChildFile(parent: Directory, name: string, mimeType: string | null): File {
  const child = new File(parent, name);
  return child.exists ? child : parent.createFile(name, mimeType);
}

/**
 * The shared 53XY/Moments directory, walked level by level from the volume
 * root so every `createDirectory` call validates against a parent that
 * already exists — see `ensureChildDirectory`. Returns null when the shared
 * volume itself is missing or inaccessible (an unusual device state, or a
 * revoked permission), which is what the fallback in `ensureMomentsDir` is
 * for.
 */
function ensureSharedMomentsDirectory(): Directory | null {
  try {
    const root = new Directory(EXTERNAL_STORAGE_ROOT);
    if (!root.exists) return null;

    const shared = pickMomentsDir(true, Paths.document.uri);
    const segments = shared.startsWith(EXTERNAL_STORAGE_ROOT)
      ? shared.slice(EXTERNAL_STORAGE_ROOT.length).split('/').filter(Boolean)
      : [];

    let current = root;
    for (const segment of segments) {
      current = ensureChildDirectory(current, segment);
    }
    return current;
  } catch (error) {
    console.warn('[moments] shared storage unavailable, falling back to app storage:', error);
    return null;
  }
}

/**
 * App document directory fallback. Paths under it are inside the app
 * sandbox, where expo-file-system always grants read/write regardless of
 * whether the path exists yet, so a plain `create()` is enough here.
 */
function ensureFallbackDirectory(): Directory {
  const dir = pickMomentsDir(false, Paths.document.uri);
  const directory = new Directory(dir);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/**
 * Creates the moments directory and its `.nomedia`, and returns the
 * directory uri. `.nomedia` is what keeps saved frames out of the gallery
 * and away from the screenshots folder — the entire reason this feature
 * exists.
 */
export function ensureMomentsDir(): string {
  if (cachedDir) return cachedDir;

  const directory = ensureSharedMomentsDirectory() ?? ensureFallbackDirectory();

  try {
    ensureChildFile(directory, '.nomedia', null);
  } catch (error) {
    // A moment that saves but is visible to the gallery beats a moment that
    // never saves — gallery hygiene is not worth failing every capture over.
    console.warn(
      '[moments] failed to create .nomedia, saved frames may be indexed by the gallery:',
      error,
    );
  }

  cachedDir = directory.uri;
  return directory.uri;
}

export function writeManifest(dir: string, moments: Moment[]): void {
  const directory = new Directory(dir);
  const file = ensureChildFile(directory, MANIFEST_FILENAME, 'application/json');
  file.write(toManifestJson(moments));
}

/** Empty when the manifest is absent, unreadable, or unparseable. */
export function readManifest(dir: string): Moment[] {
  try {
    const file = new File(new Directory(dir), MANIFEST_FILENAME);
    if (!file.exists) return [];
    return fromManifestJson(file.textSync());
  } catch (error) {
    console.warn('[moments] failed to read moments.json manifest:', error);
    return [];
  }
}

/** Best-effort: a frame that is already gone is not an error. */
export function deleteFrame(frameUri: string | null): void {
  if (!frameUri) return;
  try {
    const file = new File(frameUri);
    if (file.exists) file.delete();
  } catch (error) {
    // A frame we cannot delete is a leaked file, not a failed user action.
    console.warn('[moments] failed to delete frame file:', frameUri, error);
  }
}

/**
 * True when moments are being written to shared storage — i.e. when they will
 * survive an uninstall. False means the app fell back to its own document
 * directory, which is wiped with the app.
 */
export function momentsDirIsShared(): boolean {
  return ensureMomentsDir() === SHARED_MOMENTS_DIR;
}

/**
 * Drop the cached directory so the next `ensureMomentsDir()` probes again.
 * Needed because "All files access" can be granted while the app is running:
 * the user leaves for system settings, flips the toggle, and comes back to a
 * process whose cached answer is now stale.
 */
export function invalidateMomentsDir(): void {
  cachedDir = null;
}

/**
 * Move planned frames into the current directory. Returns the moves that
 * actually happened. Best-effort per file: one unmovable frame must not
 * abandon the rest, and a frame that fails to move keeps its old uri, which
 * still resolves.
 *
 * expo-file-system's `File.move()` is async (`Promise<void>`); the
 * synchronous counterpart callers of this function depend on is
 * `File.moveSync()`, which also requires the destination to be a `File`/
 * `Directory` instance rather than a bare uri string. See
 * `node_modules/expo-file-system/build/internal/NativeFileSystem.types.d.ts`.
 */
export function moveMomentFrames(moves: MomentMove[]): MomentMove[] {
  const moved: MomentMove[] = [];
  for (const move of moves) {
    try {
      const source = new File(move.fromUri);
      if (!source.exists) continue;
      source.moveSync(new File(move.toUri));
      moved.push(move);
    } catch (error) {
      console.warn(`[moments] could not move frame ${move.id}:`, error);
    }
  }
  return moved;
}
