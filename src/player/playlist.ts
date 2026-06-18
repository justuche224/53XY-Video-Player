export function neighbors<T extends { id: string }>(
  items: T[],
  currentId: string,
): { prev: T | null; next: T | null; index: number } {
  const index = items.findIndex((it) => it.id === currentId);
  if (index === -1) return { prev: null, next: null, index: -1 };
  return {
    prev: index > 0 ? items[index - 1] : null,
    next: index < items.length - 1 ? items[index + 1] : null,
    index,
  };
}
