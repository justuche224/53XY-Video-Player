import { toVideoRow, fromVideoRow } from '../video-row';
import type { LibraryVideo } from '@/library/types';

const sample: LibraryVideo = {
  id: 'content://media/external/video/media/42',
  uri: 'file:///storage/emulated/0/Movies/Banshee/e1.mkv',
  filename: 'Banshee S01E01 GalaxyTV.mkv',
  durationMs: 3540000,
  width: 1280,
  height: 720,
  folder: '/storage/emulated/0/Movies/Banshee',
  createdAt: 111,
  modifiedAt: 222,
};

describe('video-row mapping', () => {
  it('maps LibraryVideo to a snake_case row', () => {
    const row = toVideoRow(sample);
    expect(row).toEqual({
      id: sample.id,
      uri: sample.uri,
      filename: sample.filename,
      duration_ms: 3540000,
      size_bytes: null,
      width: 1280,
      height: 720,
      folder: sample.folder,
      modified_at: 222,
      created_at: 111,
    });
  });

  it('round-trips back to LibraryVideo', () => {
    expect(fromVideoRow(toVideoRow(sample))).toEqual(sample);
  });
});
