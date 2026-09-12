import { shouldShowHomeHint, shouldShowPlayerCard } from '../coach';

describe('shouldShowPlayerCard', () => {
  it('shows once onboarding is done and the card has not been dismissed', () => {
    expect(shouldShowPlayerCard(false, true)).toBe(true);
  });

  it('does not show while onboarding is still pending', () => {
    expect(shouldShowPlayerCard(false, false)).toBe(false);
  });

  it('does not show once dismissed', () => {
    expect(shouldShowPlayerCard(true, true)).toBe(false);
  });
});

describe('shouldShowHomeHint', () => {
  it('waits for the second visit', () => {
    expect(shouldShowHomeHint(false, 1)).toBe(false);
    expect(shouldShowHomeHint(false, 2)).toBe(true);
  });

  it('keeps showing on later visits until dismissed', () => {
    expect(shouldShowHomeHint(false, 7)).toBe(true);
  });

  it('does not show once dismissed', () => {
    expect(shouldShowHomeHint(true, 9)).toBe(false);
  });
});
