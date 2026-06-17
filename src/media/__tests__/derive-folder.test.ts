import { deriveFolder } from '../derive-folder';

describe('deriveFolder', () => {
  it('extracts parent dir and name from a file:// uri', () => {
    expect(deriveFolder('file:///storage/emulated/0/Movies/Banshee/ep1.mkv')).toEqual({
      path: '/storage/emulated/0/Movies/Banshee',
      name: 'Banshee',
    });
  });

  it('handles a path with no scheme', () => {
    expect(deriveFolder('/storage/emulated/0/DCIM/Camera/VID_001.mp4')).toEqual({
      path: '/storage/emulated/0/DCIM/Camera',
      name: 'Camera',
    });
  });

  it('decodes percent-encoded segments', () => {
    expect(deriveFolder('file:///storage/emulated/0/My%20Shows/Boston%20Legal/e1.avi')).toEqual({
      path: '/storage/emulated/0/My Shows/Boston Legal',
      name: 'Boston Legal',
    });
  });

  it('returns empty info for empty or file-only input', () => {
    expect(deriveFolder('')).toEqual({ path: '', name: '' });
    expect(deriveFolder('movie.mp4')).toEqual({ path: '', name: '' });
  });
});
