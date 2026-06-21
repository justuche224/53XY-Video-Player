/**
 * Pick the starting video for "Play All".
 * Returns the first item whose id is NOT in `completedIds`, or the first item
 * if all are completed. Returns null for an empty list.
 */
export function pickStart<T extends { id: string }>(
  items: T[],
  completedIds: Set<string>,
): T | null {
  if (items.length === 0) return null;
  const first = items.find((it) => !completedIds.has(it.id));
  return first ?? items[0];
}
