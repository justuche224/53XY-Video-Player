/**
 * Human-readable subtitle delay, e.g. `+0.50s`, `−1.25s`, `0.00s`.
 *
 * Uses U+2212 MINUS rather than a hyphen so the sign lines up optically with
 * the plus in a column of values.
 */
export function formatDelay(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '−' : '';
  return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}s`;
}
