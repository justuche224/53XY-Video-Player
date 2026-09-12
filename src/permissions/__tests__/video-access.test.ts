import { resolveVideoAccess } from '../video-access';

describe('resolveVideoAccess', () => {
  it('is unknown while the permission is still resolving', () => {
    expect(resolveVideoAccess(null)).toBe('unknown');
  });

  it('is granted when granted', () => {
    expect(resolveVideoAccess({ granted: true, canAskAgain: false })).toBe('granted');
  });

  it('is askable when not granted but the dialog can still be shown', () => {
    expect(resolveVideoAccess({ granted: false, canAskAgain: true })).toBe('askable');
  });

  it('is blocked when denied and the dialog would silently no-op', () => {
    expect(resolveVideoAccess({ granted: false, canAskAgain: false })).toBe('blocked');
  });
});
