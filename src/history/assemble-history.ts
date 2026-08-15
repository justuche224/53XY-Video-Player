import type { HistoryRow } from '@/db/history-repo';
import type { LibraryVideo } from '@/library/types';
import { dayBucket } from './bucket-day';
import type { HistorySection } from './types';

export function assembleHistory(
  rows: HistoryRow[],
  videos: LibraryVideo[],
  nowMs: number,
): HistorySection[] {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const sections: HistorySection[] = [];
  const index = new Map<string, HistorySection>();

  for (const r of rows) {
    const video = byId.get(r.videoId);
    if (!video) continue; // deleted media — never shown
    const b = dayBucket(r.lastPlayedAt, nowMs);
    let section = index.get(b.key);
    if (!section) {
      section = { key: b.key, title: b.label, data: [] };
      index.set(b.key, section);
      sections.push(section);
    }
    section.data.push({
      video,
      percent: r.percent,
      completed: r.completed,
      lastPlayedAt: r.lastPlayedAt,
    });
  }

  return sections;
}

export function filterHistory(sections: HistorySection[], query: string): HistorySection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => ({ ...s, data: s.data.filter((i) => i.video.filename.toLowerCase().includes(q)) }))
    .filter((s) => s.data.length > 0);
}
