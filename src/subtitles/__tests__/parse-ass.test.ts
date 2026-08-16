import { parseAss } from '../parse-ass';

const HEADER = ['[Script Info]', 'Title: Test', '', '[V4+ Styles]', 'Format: Name, Fontname', 'Style: Default,Arial', ''];

function file(...eventLines: string[]): string {
  return [...HEADER, '[Events]', ...eventLines].join('\n');
}

describe('parseAss', () => {
  it('parses dialogue lines using the Format column order', () => {
    const src = file(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello there.',
    );
    expect(parseAss(src)).toEqual([{ startMs: 1000, endMs: 3500, text: 'Hello there.' }]);
  });

  it('honours a reordered Format line', () => {
    const src = file(
      'Format: Layer, Style, Start, End, Text',
      'Dialogue: 0,Default,0:00:02.00,0:00:04.00,Reordered',
    );
    expect(parseAss(src)).toEqual([{ startMs: 2000, endMs: 4000, text: 'Reordered' }]);
  });

  it('keeps commas inside the text field', () => {
    const src = file(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Wait, no, stop!',
    );
    expect(parseAss(src)[0].text).toBe('Wait, no, stop!');
  });

  it('strips override blocks and converts \\N to newlines', () => {
    const src = file(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\pos(400,570)\\c&H00FFFF&}Top\\NBottom',
    );
    expect(parseAss(src)[0].text).toBe('Top\nBottom');
  });

  it('drops vector drawing commands', () => {
    const src = file(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,{\\p1}m 0 0 l 100 0 100 100 0 100{\\p0}',
      'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Real dialogue',
    );
    expect(parseAss(src)).toEqual([{ startMs: 3000, endMs: 4000, text: 'Real dialogue' }]);
  });

  it('parses centisecond timestamps correctly', () => {
    const src = file(
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:01.05,0:00:02.50,Default,,0,0,0,,Hi',
    );
    expect(parseAss(src)[0]).toEqual({ startMs: 1050, endMs: 2500, text: 'Hi' });
  });

  it('ignores dialogue outside the [Events] section and lines before Format', () => {
    const src = [
      '[Events]',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,No format line yet',
      'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
      'Dialogue: 0,0:00:03.00,0:00:04.00,Default,,0,0,0,,Kept',
      '[Fonts]',
      'Dialogue: 0,0:00:05.00,0:00:06.00,Default,,0,0,0,,Not dialogue',
    ].join('\n');
    expect(parseAss(src)).toEqual([{ startMs: 3000, endMs: 4000, text: 'Kept' }]);
  });

  it('sorts by start time and drops backwards cues', () => {
    const src = file(
      'Format: Layer, Start, End, Text',
      'Dialogue: 0,0:00:09.00,0:00:10.00,Later',
      'Dialogue: 0,0:00:08.00,0:00:02.00,Backwards',
      'Dialogue: 0,0:00:01.00,0:00:02.00,Earlier',
    );
    expect(parseAss(src).map((c) => c.text)).toEqual(['Earlier', 'Later']);
  });
});
