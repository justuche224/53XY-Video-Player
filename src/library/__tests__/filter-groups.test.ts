import { filterGroups } from '../filter-groups';
import type { Group } from '../types';

const g = (title: string): Group => ({ key: title.toLowerCase(), title, kind: 'name', items: [], count: 0 });

describe('filterGroups', () => {
  const groups = [g('Banshee'), g('Boston Legal'), g('Citadel')];
  it('returns all groups for an empty/whitespace query', () => {
    expect(filterGroups(groups, '')).toBe(groups);
    expect(filterGroups(groups, '   ')).toBe(groups);
  });
  it('matches case-insensitive substrings of the title', () => {
    expect(filterGroups(groups, 'bo').map((x) => x.title)).toEqual(['Boston Legal']);
    expect(filterGroups(groups, 'e').map((x) => x.title)).toEqual(['Banshee', 'Boston Legal', 'Citadel']);
  });
  it('returns empty when nothing matches', () => {
    expect(filterGroups(groups, 'zzz')).toEqual([]);
  });
});
