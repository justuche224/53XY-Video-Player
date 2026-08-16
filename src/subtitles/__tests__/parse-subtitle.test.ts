import { subtitleFormatOf, parseSubtitle, sniffSubtitleFormat, SUBTITLE_EXTENSIONS } from '../parse-subtitle';

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

describe('sniffSubtitleFormat', () => {
  it('identifies vtt by its WEBVTT header', () => {
    expect(sniffSubtitleFormat('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toBe('vtt');
  });

  it('identifies ass by its [Script Info] or [Events] section', () => {
    expect(sniffSubtitleFormat('[Script Info]\nTitle: x\n')).toBe('ass');
    expect(
      sniffSubtitleFormat('[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,Hi'),
    ).toBe('ass');
  });

  it('identifies srt by its comma-millisecond timecode arrow', () => {
    expect(sniffSubtitleFormat('1\n00:00:01,000 --> 00:00:02,000\nHi\n')).toBe('srt');
  });

  it('returns null for content matching no known format', () => {
    expect(sniffSubtitleFormat('just some random text\nwith no subtitle markers at all')).toBeNull();
  });
});

describe('parseSubtitle content-sniffing fallback', () => {
  // A SAF content:// pick from the Downloads provider hands back an opaque
  // document id with no extension in place of a real filename.
  const OPAQUE_NAME = 'msf:1000000123';

  it('sniffs the format when the name has no recognizable extension', () => {
    expect(parseSubtitle(OPAQUE_NAME, '1\n00:00:01,000 --> 00:00:02,000\nHi\n')).toEqual([
      { startMs: 1000, endMs: 2000, text: 'Hi' },
    ]);
    expect(parseSubtitle(OPAQUE_NAME, 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHi\n')).toEqual([
      { startMs: 1000, endMs: 2000, text: 'Hi' },
    ]);
    expect(
      parseSubtitle(
        OPAQUE_NAME,
        '[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,Hi',
      ),
    ).toEqual([{ startMs: 1000, endMs: 2000, text: 'Hi' }]);
  });

  it('still prefers the extension over sniffing when the name has one', () => {
    // SRT-named file whose body is actually ASS content — the extension
    // wins, so this is dispatched to the srt parser, which finds no '-->'
    // line and comes out empty rather than being sniffed as ass.
    expect(
      parseSubtitle('a.srt', '[Events]\nFormat: Start, End, Text\nDialogue: 0:00:01.00,0:00:02.00,Hi'),
    ).toEqual([]);
  });
});
