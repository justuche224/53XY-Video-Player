import { parseSrt } from '../parse-srt';

describe('parseSrt', () => {
  it('parses a well-formed file', () => {
    const src = [
      '1',
      '00:00:01,000 --> 00:00:03,500',
      'Hello there.',
      '',
      '2',
      '00:00:04,000 --> 00:00:06,000',
      'Line one',
      'Line two',
      '',
    ].join('\n');
    expect(parseSrt(src)).toEqual([
      { startMs: 1000, endMs: 3500, text: 'Hello there.' },
      { startMs: 4000, endMs: 6000, text: 'Line one\nLine two' },
    ]);
  });

  it('handles CRLF line endings', () => {
    const src = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n\r\n';
    expect(parseSrt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('handles a missing trailing blank line', () => {
    const src = '1\n00:00:01,000 --> 00:00:02,000\nHi';
    expect(parseSrt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('does not swallow the next sequence number when the blank line is missing', () => {
    const src = ['1', '00:00:01,000 --> 00:00:02,000', 'First', '2', '00:00:03,000 --> 00:00:04,000', 'Second'].join('\n');
    expect(parseSrt(src)).toEqual([
      { startMs: 1000, endMs: 2000, text: 'First' },
      { startMs: 3000, endMs: 4000, text: 'Second' },
    ]);
  });

  it('works without sequence numbers at all', () => {
    const src = '00:00:01,000 --> 00:00:02,000\nHi\n';
    expect(parseSrt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('strips inline formatting tags', () => {
    const src = '1\n00:00:01,000 --> 00:00:02,000\n<i>Whispered</i> <b>loudly</b>\n';
    expect(parseSrt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Whispered loudly' }]);
  });

  it('drops empty cues and cues that end before they start', () => {
    const src = [
      '1', '00:00:01,000 --> 00:00:02,000', '', '',
      '2', '00:00:09,000 --> 00:00:05,000', 'Backwards', '',
      '3', '00:00:10,000 --> 00:00:11,000', 'Kept', '',
    ].join('\n');
    expect(parseSrt(src)).toEqual([{ startMs: 10000, endMs: 11000, text: 'Kept' }]);
  });

  it('sorts out-of-order cues by start time', () => {
    const src = [
      '1', '00:00:09,000 --> 00:00:10,000', 'Later', '',
      '2', '00:00:01,000 --> 00:00:02,000', 'Earlier', '',
    ].join('\n');
    expect(parseSrt(src).map((c) => c.text)).toEqual(['Earlier', 'Later']);
  });

  it('returns an empty array for junk input', () => {
    expect(parseSrt('not a subtitle file at all')).toEqual([]);
  });
});
