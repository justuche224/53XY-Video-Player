export interface LibraryVideo {
  id: string;
  uri: string;
  filename: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  thumbUri: string | null;
  createdAt: number | null;
  modifiedAt: number | null;
}

export interface EpisodeInfo {
  season: number | null;
  episode: number | null;
}

export interface Group {
  key: string;
  title: string;
  kind: 'name' | 'folder';
  items: LibraryVideo[];
  count: number;
}
