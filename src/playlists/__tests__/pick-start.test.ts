import { pickStart } from '../pick-start';

const item = (id: string) => ({ id });

describe('pickStart', () => {
  it('returns the first item when none are completed', () => {
    const result = pickStart([item('a'), item('b'), item('c')], new Set());
    expect(result?.id).toBe('a');
  });

  it('skips completed items and returns the first incomplete', () => {
    const result = pickStart(
      [item('a'), item('b'), item('c')],
      new Set(['a']),
    );
    expect(result?.id).toBe('b');
  });

  it('returns the first item when all are completed', () => {
    const result = pickStart(
      [item('a'), item('b')],
      new Set(['a', 'b']),
    );
    expect(result?.id).toBe('a');
  });

  it('returns null for an empty array', () => {
    expect(pickStart([], new Set())).toBeNull();
  });
});
