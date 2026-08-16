import { decodeSubtitleBytes } from '../decode-text';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

describe('decodeSubtitleBytes', () => {
  it('decodes plain ASCII', () => {
    expect(decodeSubtitleBytes(bytes(0x48, 0x69))).toBe('Hi');
  });

  it('strips a UTF-8 BOM', () => {
    // BOM + "Hé" as UTF-8 (0xc3 0xa9)
    expect(decodeSubtitleBytes(bytes(0xef, 0xbb, 0xbf, 0x48, 0xc3, 0xa9))).toBe('Hé');
  });

  it('decodes UTF-8 without a BOM', () => {
    expect(decodeSubtitleBytes(bytes(0x48, 0xc3, 0xa9))).toBe('Hé');
  });

  it('falls back to CP1252 for bytes that are not valid UTF-8', () => {
    // 0xe9 is 'é' in CP1252, and an invalid lead byte sequence in UTF-8.
    expect(decodeSubtitleBytes(bytes(0x48, 0xe9))).toBe('Hé');
  });

  it('maps the CP1252 0x80-0x9f range rather than treating it as control codes', () => {
    // 0x92 is a right single quote in CP1252, not a C1 control character.
    expect(decodeSubtitleBytes(bytes(0x49, 0x92, 0x6d))).toBe('I\u{2019}m');
  });

  it('decodes UTF-16LE with a BOM', () => {
    expect(decodeSubtitleBytes(bytes(0xff, 0xfe, 0x48, 0x00, 0xe9, 0x00))).toBe('Hé');
  });

  it('decodes UTF-16BE with a BOM', () => {
    expect(decodeSubtitleBytes(bytes(0xfe, 0xff, 0x00, 0x48, 0x00, 0xe9))).toBe('Hé');
  });

  it('decodes multi-byte UTF-8 beyond the BMP', () => {
    // U+1F600 grinning face
    expect(decodeSubtitleBytes(bytes(0xf0, 0x9f, 0x98, 0x80))).toBe('\u{1F600}');
  });
});
