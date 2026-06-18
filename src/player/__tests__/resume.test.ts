import { shouldResume } from '../resume';
describe('shouldResume', () => {
  it('resumes mid-video past the 5s floor', () => {
    expect(shouldResume(30_000, 0.25)).toBe(true);
  });
  it('does not resume within the first 5s', () => {
    expect(shouldResume(4_000, 0.01)).toBe(false);
  });
  it('does not resume a finished video', () => {
    expect(shouldResume(600_000, 0.98)).toBe(false);
  });
});
