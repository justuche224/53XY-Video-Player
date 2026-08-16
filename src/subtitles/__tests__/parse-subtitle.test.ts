import { subtitleFormatOf, parseSubtitle, SUBTITLE_EXTENSIONS } from '../parse-subtitle';

describe('subtitleFormatOf', () => {
  it('maps every supported extension', () => {
    expect(subtitleFormatOf('a.srt')).toBe('srt');
    expect(subtitleFormatOf('a.vtt')).toBe('vtt');
    expect(subtitleFormatOf('a.ass')).toBe('ass');
    expect(subtitleFormatOf('a.ssa')).toBe('ass');
  });

  it('is case-insensitive', () => {
    expect(subtitleFormatOf('A.SRT')).toBe('srt');
  });

  it('rejects anything else', () => {
    expect(subtitleFormatOf('a.mkv')).toBeNull();
    expect(subtitleFormatOf('noextension')).toBeNull();
    expect(subtitleFormatOf('a.srt.bak')).toBeNull();
  });

  it('covers exactly the advertised extension list', () => {
    expect([...SUBTITLE_EXTENSIONS]).toEqual(['srt', 'vtt', 'ass', 'ssa']);
  });
});

describe('parseSubtitle', () => {
  it('dispatches on extension', () => {
    expect(parseSubtitle('a.srt', '1\n00:00:01,000 --> 00:00:02,000\nHi\n')).toEqual([
      { startMs: 1000, endMs: 2000, text: 'Hi' },
    ]);
    expect(parseSubtitle('a.vtt', 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toEqual([
      { startMs: 1000, endMs: 2000, text: 'Hi' },
    ]);
    expect(
      parseSubtitle('a.ass', '[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,Hi'),
    ).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('returns an empty array for an unsupported extension', () => {
    expect(parseSubtitle('a.mkv', 'whatever')).toEqual([]);
  });
});
