import { parseVtt } from '../parse-vtt';

describe('parseVtt', () => {
  it('parses a well-formed file with a header', () => {
    const src = ['WEBVTT', '', '00:00:01.000 --> 00:00:03.500', 'Hello there.', ''].join('\n');
    expect(parseVtt(src)).toEqual([{ startMs: 1000, endMs: 3500, text: 'Hello there.' }]);
  });

  it('discards NOTE and STYLE blocks', () => {
    const src = [
      'WEBVTT',
      '',
      'NOTE this is a comment',
      'that spans lines',
      '',
      'STYLE',
      '::cue { color: red }',
      '',
      '00:00:01.000 --> 00:00:02.000',
      'Kept',
      '',
    ].join('\n');
    expect(parseVtt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Kept' }]);
  });

  it('ignores cue settings after the end timestamp', () => {
    const src = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:start line:90%\nHi\n';
    expect(parseVtt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('accepts timestamps with the hour field omitted', () => {
    const src = 'WEBVTT\n\n01:05.250 --> 01:06.000\nHi\n';
    expect(parseVtt(src)).toEqual([{ startMs: 65250, endMs: 66000, text: 'Hi' }]);
  });

  it('skips cue identifier lines', () => {
    const src = 'WEBVTT\n\nintro-line\n00:00:01.000 --> 00:00:02.000\nHi\n';
    expect(parseVtt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('strips voice spans', () => {
    const src = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Roger>Hello\n';
    expect(parseVtt(src)).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hello' }]);
  });
});
