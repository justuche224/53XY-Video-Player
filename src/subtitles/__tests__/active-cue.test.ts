import { activeCues, cueTextOf } from '../active-cue';
import type { Cue } from '../types';

const CUES: Cue[] = [
  { startMs: 1000, endMs: 2000, text: 'One' },
  { startMs: 3000, endMs: 4000, text: 'Two' },
  { startMs: 5000, endMs: 6000, text: 'Three' },
];

describe('activeCues', () => {
  it('finds the cue covering the time', () => {
    expect(activeCues(CUES, 3500, 0).map((c) => c.text)).toEqual(['Two']);
  });

  it('treats start as inclusive and end as exclusive', () => {
    expect(activeCues(CUES, 3000, 0).map((c) => c.text)).toEqual(['Two']);
    expect(activeCues(CUES, 4000, 0)).toEqual([]);
  });

  it('returns nothing in the gaps, before the first cue, and after the last', () => {
    expect(activeCues(CUES, 2500, 0)).toEqual([]);
    expect(activeCues(CUES, 0, 0)).toEqual([]);
    expect(activeCues(CUES, 99000, 0)).toEqual([]);
  });

  it('returns an empty array for no cues', () => {
    expect(activeCues([], 1000, 0)).toEqual([]);
  });

  it('shifts subtitles later for a positive delay', () => {
    // +1000ms means the line that played at 3500 now plays at 4500.
    expect(activeCues(CUES, 4500, 1000).map((c) => c.text)).toEqual(['Two']);
    expect(activeCues(CUES, 3500, 1000)).toEqual([]);
  });

  it('shifts subtitles earlier for a negative delay', () => {
    expect(activeCues(CUES, 2500, -1000).map((c) => c.text)).toEqual(['Two']);
  });

  it('handles a delay that pushes lookup below zero or past the end', () => {
    expect(activeCues(CUES, 500, 60000)).toEqual([]);
    expect(activeCues(CUES, 1500, -60000)).toEqual([]);
  });

  it('returns overlapping cues in start order', () => {
    const overlapping: Cue[] = [
      { startMs: 1000, endMs: 9000, text: 'Sign' },
      { startMs: 2000, endMs: 3000, text: 'Dialogue' },
    ];
    expect(activeCues(overlapping, 2500, 0).map((c) => c.text)).toEqual(['Sign', 'Dialogue']);
  });

  it('caps the number of simultaneous cues', () => {
    const many: Cue[] = [0, 1, 2, 3, 4].map((i) => ({
      startMs: i * 10,
      endMs: 100000,
      text: `c${i}`,
    }));
    expect(activeCues(many, 500, 0)).toHaveLength(3);
  });
});

describe('cueTextOf', () => {
  it('joins cues with newlines', () => {
    expect(cueTextOf(CUES.slice(0, 2))).toBe('One\nTwo');
  });

  it('is empty for no cues', () => {
    expect(cueTextOf([])).toBe('');
  });
});
