/**
 * How many videos one share may carry.
 *
 * Not an app-stability limit: the intent carries only URI strings, so even a
 * thousand sits far under Android's ~1MB binder transaction ceiling. The real
 * ceiling is the receiving app (WhatsApp takes ~30 media per share, mail apps
 * cap on total size), so this is a courtesy bound well above any sane share.
 */
export const SHARE_CAP = 50;

export type ShareDecision =
  | { kind: 'empty' }
  | { kind: 'too-many'; count: number }
  | { kind: 'share'; ids: string[] };

/**
 * Decide what a share of `ids` should do. Over the cap it refuses outright and
 * reports the count — deliberately never a trimmed list, so a share is always
 * exactly what was selected or nothing at all.
 */
export function resolveShare(ids: string[]): ShareDecision {
  if (ids.length === 0) return { kind: 'empty' };
  if (ids.length > SHARE_CAP) return { kind: 'too-many', count: ids.length };
  return { kind: 'share', ids };
}
