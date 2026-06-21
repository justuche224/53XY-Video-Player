import { assembleHistory, filterHistory } from '../assemble-history';
import type { LibraryVideo } from '@/library/types';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).getTime();
const now = at(2026, 5, 21, 15);

const vid = (id: string, filename = `${id}.mp4`): LibraryVideo => ({
  id,
  uri: `file:///${id}.mp4`,
  filename,
  durationMs: 1000,
  width: null,
  height: null,
  folder: '/Movies',
  thumbUri: null,
  createdAt: null,
  modifiedAt: null,
});

const row = (videoId: string, lastPlayedAt: number, percent = 0.4) => ({
  videoId,
  positionMs: 100,
  percent,
  lastPlayedAt,
});

describe('assembleHistory', () => {
  it('joins rows to videos and buckets them by day, newest-first', () => {
    const rows = [
      row('a', at(2026, 5, 21, 14)),
      row('b', at(2026, 5, 20, 10)),
      row('c', at(2026, 5, 19, 10)),
    ];
    const videos = [vid('a'), vid('b'), vid('c')];
    const sections = assembleHistory(rows, videos, now);
    expect(sections.map((s) => s.title)).toEqual(['Today', 'Yesterday', 'Jun 19']);
    expect(sections[0].data[0].video.id).toBe('a');
    expect(sections[0].data[0].percent).toBe(0.4);
  });

  it('groups multiple entries from the same day into one section in order', () => {
    const rows = [row('a', at(2026, 5, 21, 14)), row('b', at(2026, 5, 21, 9))];
    const sections = assembleHistory(rows, [vid('a'), vid('b')], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((i) => i.video.id)).toEqual(['a', 'b']);
  });

  it('drops rows whose video is missing (deleted media)', () => {
    const rows = [row('a', at(2026, 5, 21, 14)), row('gone', at(2026, 5, 21, 9))];
    const sections = assembleHistory(rows, [vid('a')], now);
    expect(sections).toHaveLength(1);
    expect(sections[0].data.map((i) => i.video.id)).toEqual(['a']);
  });

  it('returns an empty array when nothing resolves', () => {
    expect(assembleHistory([row('gone', now)], [], now)).toEqual([]);
  });
});

describe('filterHistory', () => {
  const sections = [
    { key: '1', title: 'Today', data: [
      { video: vid('a', 'Inception.mp4'), percent: 0.1, lastPlayedAt: 1 },
      { video: vid('b', 'Tenet.mkv'), percent: 0.2, lastPlayedAt: 2 },
    ] },
    { key: '2', title: 'Yesterday', data: [
      { video: vid('c', 'Dunkirk.mp4'), percent: 0.3, lastPlayedAt: 3 },
    ] },
  ];

  it('returns input unchanged for an empty query', () => {
    expect(filterHistory(sections, '   ')).toBe(sections);
  });

  it('filters items by filename substring, case-insensitive, dropping empty sections', () => {
    const result = filterHistory(sections, 'ten');
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Today');
    expect(result[0].data.map((i) => i.video.id)).toEqual(['b']);
  });
});
