/**
 * Parse a subtitle timecode to milliseconds. Covers every dialect we support:
 *   SRT  00:00:01,500      (comma, milliseconds)
 *   VTT  00:00:01.500      (dot, milliseconds; hour field optional)
 *   ASS  0:00:01.50        (dot, centiseconds, one-digit hour)
 * Returns null when the string is not a timecode at all.
 */
export function parseTimecode(raw: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(raw.trim());
  if (!m) return null;
  const [, h, mm, ss, frac] = m;
  // '5' -> 500ms, '50' -> 500ms, '050' -> 50ms. Padding right is correct for
  // both centiseconds (ASS) and milliseconds (SRT/VTT).
  const fracMs = frac ? Number(frac.padEnd(3, '0')) : 0;
  return (Number(h ?? 0) * 3600 + Number(mm) * 60 + Number(ss)) * 1000 + fracMs;
}
