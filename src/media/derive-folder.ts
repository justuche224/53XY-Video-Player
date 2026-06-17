export interface FolderInfo {
  path: string;
  name: string;
}

export function deriveFolder(uri: string): FolderInfo {
  if (!uri) return { path: '', name: '' };
  // Strip scheme (file://) and decode %20 etc.
  let p = uri.replace(/^[a-z]+:\/+/i, '/');
  try {
    p = decodeURIComponent(p);
  } catch {
    // leave as-is if it is not valid percent-encoding
  }
  const lastSlash = p.lastIndexOf('/');
  if (lastSlash <= 0) return { path: '', name: '' };
  const path = p.slice(0, lastSlash).replace(/\/+$/, '');
  const name = path.slice(path.lastIndexOf('/') + 1);
  return { path, name };
}
