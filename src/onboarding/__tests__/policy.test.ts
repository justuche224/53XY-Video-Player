import {
  ONBOARDING_VERSION,
  isLastSlide,
  nextSlideIndex,
  prevSlideIndex,
  resolveOnboardingGate,
} from '../policy';
import { SLIDES } from '../slides';

describe('resolveOnboardingGate', () => {
  it('needs onboarding when nothing is stored', () => {
    expect(resolveOnboardingGate(null, 1)).toBe('needed');
  });

  it('needs onboarding when the stored version is behind', () => {
    expect(resolveOnboardingGate('0', 1)).toBe('needed');
  });

  it('is done when the stored version matches', () => {
    expect(resolveOnboardingGate('1', 1)).toBe('done');
  });

  it('is done when the stored version is ahead (downgraded build)', () => {
    expect(resolveOnboardingGate('9', 1)).toBe('done');
  });

  it('treats unparseable stored values as never onboarded', () => {
    expect(resolveOnboardingGate('yes', 1)).toBe('needed');
    expect(resolveOnboardingGate('', 1)).toBe('needed');
  });
});

describe('pager bounds', () => {
  it('advances within range', () => {
    expect(nextSlideIndex(0, 6)).toBe(1);
    expect(nextSlideIndex(4, 6)).toBe(5);
  });

  it('does not advance past the last slide', () => {
    expect(nextSlideIndex(5, 6)).toBe(5);
  });

  it('goes back within range', () => {
    expect(prevSlideIndex(3)).toBe(2);
  });

  it('is a no-op going back from the first slide', () => {
    expect(prevSlideIndex(0)).toBe(0);
  });

  it('knows the last slide', () => {
    expect(isLastSlide(5, 6)).toBe(true);
    expect(isLastSlide(4, 6)).toBe(false);
  });
});

describe('SLIDES', () => {
  it('is the six slides the spec defines, in order', () => {
    expect(SLIDES.map((s) => s.key)).toEqual([
      'welcome',
      'grouping',
      'continuity',
      'gestures',
      'moments',
      'done',
    ]);
  });

  it('puts the video-access ask first so the scan runs during the tour', () => {
    expect(SLIDES[0].action).toBe('video-access');
  });

  it('asks for all-files access on the moments slide', () => {
    expect(SLIDES[4].action).toBe('all-files');
  });

  it('finishes on the last slide', () => {
    expect(SLIDES[SLIDES.length - 1].action).toBe('finish');
  });

  it('uses one label per intent', () => {
    const bodies = SLIDES.map((s) => s.body);
    expect(bodies.every((b) => b.length > 0)).toBe(true);
    expect(new Set(SLIDES.map((s) => s.key)).size).toBe(SLIDES.length);
  });

  it('ships version 1', () => {
    expect(ONBOARDING_VERSION).toBe(1);
  });
});
