export type VideoAccess = 'unknown' | 'granted' | 'askable' | 'blocked';

/**
 * `blocked` matters because requesting again after the user has permanently
 * denied silently resolves without showing a dialog — the UI has to deep-link
 * to app settings instead of pretending an ask happened.
 */
export function resolveVideoAccess(
  permission: { granted: boolean; canAskAgain: boolean } | null,
): VideoAccess {
  if (!permission) return 'unknown';
  if (permission.granted) return 'granted';
  return permission.canAskAgain ? 'askable' : 'blocked';
}
