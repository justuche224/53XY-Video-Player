import type { LibraryVideo } from '@/library/types';

export interface VideoRow {
  id: string;
  uri: string;
  filename: string;
  duration_ms: number | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  folder: string;
  modified_at: number | null;
  created_at: number | null;
}

export function toVideoRow(v: LibraryVideo): VideoRow {
  return {
    id: v.id,
    uri: v.uri,
    filename: v.filename,
    duration_ms: v.durationMs,
    size_bytes: null,
    width: v.width,
    height: v.height,
    folder: v.folder,
    modified_at: v.modifiedAt,
    created_at: v.createdAt,
  };
}

export function fromVideoRow(r: VideoRow): LibraryVideo {
  return {
    id: r.id,
    uri: r.uri,
    filename: r.filename,
    durationMs: r.duration_ms,
    width: r.width,
    height: r.height,
    folder: r.folder,
    createdAt: r.created_at,
    modifiedAt: r.modified_at,
  };
}
