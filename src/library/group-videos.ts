import { normalizeTitle } from './normalize-title';
import { parseEpisode } from './parse-episode';
import type { Group, LibraryVideo } from './types';

const INF = Number.MAX_SAFE_INTEGER;
const NUMBER_TOKEN = /\b\d{2,4}\b/;

function byTitle(a: Group, b: Group): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

function sortEpisodes(items: LibraryVideo[]): void {
  items.sort((a, b) => {
    const ea = parseEpisode(a.filename);
    const eb = parseEpisode(b.filename);
    return (
      (ea.season ?? INF) - (eb.season ?? INF) ||
      (ea.episode ?? INF) - (eb.episode ?? INF) ||
      a.filename.localeCompare(b.filename)
    );
  });
}

// The clean-name candidates for a numbered title: the text on either side of
// its first number token, e.g. "201 Boston Legal" -> ["Boston Legal"],
// "Boston Legal 301 Cant We All" -> ["Boston Legal", "Cant We All"].
function anchorCandidates(title: string): string[] {
  const m = title.match(NUMBER_TOKEN);
  if (!m || m.index === undefined) return [];
  const before = title.slice(0, m.index).trim();
  const after = title.slice(m.index + m[0].length).trim();
  return [before, after].filter((s) => s.length > 0);
}

// Conservative, corroborated merge: fold a numbered title into a clean group
// ONLY when that clean group already exists (e.g. "201 Boston Legal" -> the
// "Boston Legal" group from its SxxExx episodes). Movies like "127 Hours" stay
// put because no "Hours" anchor exists.
function mergeNumericVariants(groups: Group[]): Group[] {
  const anchors = new Map<string, Group>();
  for (const g of groups) {
    if (!NUMBER_TOKEN.test(g.title)) anchors.set(g.title.toLowerCase(), g);
  }
  const result: Group[] = [];
  for (const g of groups) {
    if (!NUMBER_TOKEN.test(g.title)) {
      result.push(g);
      continue;
    }
    const anchor = anchorCandidates(g.title)
      .map((c) => anchors.get(c.toLowerCase()))
      .find((a): a is Group => a !== undefined && a !== g);
    if (anchor) {
      anchor.items.push(...g.items);
    } else {
      result.push(g);
    }
  }
  for (const g of result) {
    sortEpisodes(g.items);
    g.count = g.items.length;
  }
  return result.sort(byTitle);
}

export function groupByName(videos: LibraryVideo[], manualGroups: Map<string, string>): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const manualGroup = manualGroups.get(video.id);
    const title = manualGroup || normalizeTitle(video.filename);
    const key = title.toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = { key, title, kind: 'name', items: [], count: 0 };
      map.set(key, group);
    }
    group.items.push(video);
  }
  return mergeNumericVariants([...map.values()]);
}

export function groupByFolder(videos: LibraryVideo[], manualGroups: Map<string, string>): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const manualGroup = manualGroups.get(video.id);
    const key = manualGroup || video.folder || '';
    let group = map.get(key);
    if (!group) {
      let name: string;
      if (manualGroup) {
        name = manualGroup;
      } else if (key) {
        const lastSlash = key.lastIndexOf('/');
        name = lastSlash >= 0 ? key.slice(lastSlash + 1) : key;
        name = name || 'Unknown';
      } else {
        name = 'Unknown';
      }
      group = { key, title: name, kind: 'folder', items: [], count: 0 };
      map.set(key, group);
    }
    group.items.push(video);
  }
  for (const group of map.values()) {
    group.items.sort((a, b) => a.filename.localeCompare(b.filename));
    group.count = group.items.length;
  }
  return [...map.values()].sort(byTitle);
}
