import { doubleTapAction } from '../double-tap';

describe('doubleTapAction', () => {
  it('keeps all zones active when controls are hidden', () => {
    expect(doubleTapAction('left', false)).toBe('seek');
    expect(doubleTapAction('center', false)).toBe('toggle');
    expect(doubleTapAction('right', false)).toBe('seek');
  });

  it('allows side seeks but not center toggle when controls are visible', () => {
    expect(doubleTapAction('left', true)).toBe('seek');
    expect(doubleTapAction('center', true)).toBe('none');
    expect(doubleTapAction('right', true)).toBe('seek');
  });
});
