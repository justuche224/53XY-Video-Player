import { framePath, frameFileName, pickMomentsDir } from '../moments-dir';
import { SHARED_MOMENTS_DIR } from '../moment-policy';

describe('pickMomentsDir', () => {
  it('prefers shared storage, so moments survive uninstall', () => {
    expect(pickMomentsDir(true, 'file:///data/user/0/app/files/')).toBe(SHARED_MOMENTS_DIR);
  });

  it('falls back to the document directory when shared storage is unwritable', () => {
    expect(pickMomentsDir(false, 'file:///data/user/0/app/files/')).toBe(
      'file:///data/user/0/app/files/moments',
    );
  });

  it('does not double the separator when the document dir lacks a trailing slash', () => {
    expect(pickMomentsDir(false, 'file:///data/user/0/app/files')).toBe(
      'file:///data/user/0/app/files/moments',
    );
  });
});

describe('frame paths', () => {
  it('names a frame after its moment id', () => {
    expect(frameFileName('m1')).toBe('m1.jpg');
  });

  it('joins a dir and an id into one path with a single separator', () => {
    expect(framePath(SHARED_MOMENTS_DIR, 'm1')).toBe(
      'file:///storage/emulated/0/53XY/Moments/m1.jpg',
    );
    expect(framePath('file:///a/b/', 'm1')).toBe('file:///a/b/m1.jpg');
  });
});
