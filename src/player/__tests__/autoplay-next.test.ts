import { shouldAutoplayNext, AUTOPLAY_COUNTDOWN_SEC } from '../autoplay-next';

describe('shouldAutoplayNext', () => {
  it('counts down only with a neighbor, setting on, and no end-of-video sleep timer', () => {
    expect(shouldAutoplayNext(true, true, false)).toBe(true);
  });
  it('never fires without a next neighbor', () => {
    expect(shouldAutoplayNext(false, true, false)).toBe(false);
  });
  it('never fires when the setting is off', () => {
    expect(shouldAutoplayNext(true, false, false)).toBe(false);
  });
  it('sleep timer end-of-video suppresses autoplay', () => {
    expect(shouldAutoplayNext(true, true, true)).toBe(false);
  });
  it('countdown length is 5s per spec', () => {
    expect(AUTOPLAY_COUNTDOWN_SEC).toBe(5);
  });
});
