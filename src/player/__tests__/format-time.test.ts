import { formatTime } from '../format-time';
describe('formatTime', () => {
  it('formats under an hour as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(754)).toBe('12:34');
  });
  it('formats an hour or more as h:mm:ss', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });
  it('clamps bad input to 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
    expect(formatTime(NaN)).toBe('0:00');
  });
});
