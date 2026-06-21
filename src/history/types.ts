import type { LibraryVideo } from '@/library/types';

export interface HistoryItem {
  video: LibraryVideo;
  percent: number;
  lastPlayedAt: number;
}

export interface HistorySection {
  key: string;
  title: string;
  data: HistoryItem[];
}
