import { deriveFolder } from '@/media/derive-folder';
import { normalizeTitle } from './normalize-title';
import { parseEpisode } from './parse-episode';
import type { Group, LibraryVideo } from './types';

const INF = Number.MAX_SAFE_INTEGER;

function byTitle(a: Group, b: Group): number {
  return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
}

export function groupByName(videos: LibraryVideo[]): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const title = normalizeTitle(video.filename);
    const key = title.toLowerCase();
    let group = map.get(key);
    if (!group) {
      group = { key, title, kind: 'name', items: [], count: 0 };
      map.set(key, group);
    }
    group.items.push(video);
  }
  for (const group of map.values()) {
    group.items.sort((a, b) => {
      const ea = parseEpisode(a.filename);
      const eb = parseEpisode(b.filename);
      return (
        (ea.season ?? INF) - (eb.season ?? INF) ||
        (ea.episode ?? INF) - (eb.episode ?? INF) ||
        a.filename.localeCompare(b.filename)
      );
    });
    group.count = group.items.length;
  }
  return [...map.values()].sort(byTitle);
}

export function groupByFolder(videos: LibraryVideo[]): Group[] {
  const map = new Map<string, Group>();
  for (const video of videos) {
    const key = video.folder || '';
    let group = map.get(key);
    if (!group) {
      let name: string;
      if (key) {
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
