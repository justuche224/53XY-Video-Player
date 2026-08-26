import { formatDelay } from '../format-delay';

describe('formatDelay', () => {
  it('signs a positive delay', () => {
    expect(formatDelay(500)).toBe('+0.50s');
  });

  it('signs a negative delay with a real minus', () => {
    expect(formatDelay(-1250)).toBe('−1.25s');
  });

  it('leaves zero unsigned', () => {
    expect(formatDelay(0)).toBe('0.00s');
  });
});
