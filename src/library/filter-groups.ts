import type { Group } from './types';

export function filterGroups(groups: Group[], query: string): Group[] {
  const q = query.trim().toLowerCase();
  if (!q) return groups;
  return groups.filter((g) => g.title.toLowerCase().includes(q));
}
