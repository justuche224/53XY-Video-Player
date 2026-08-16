// Subtitle files in the wild are frequently not UTF-8 (Windows-1252 for
// Western European, and legacy codepages beyond that). TextDecoder is either
// absent or UTF-8-only in React Native, so both decoders are hand-rolled.

/** CP1252 mappings for 0x80-0x9F, where it differs from Latin-1. */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
];

const CHUNK = 4096;

function codePointsToString(cps: number[]): string {
  let out = '';
  for (let i = 0; i < cps.length; i += CHUNK) {
    out += String.fromCodePoint(...cps.slice(i, i + CHUNK));
  }
  return out;
}

/** Strict UTF-8 decode. Returns null on any invalid sequence, which is the
 *  signal to fall back to CP1252. */
function decodeUtf8(bytes: Uint8Array): string | null {
  const cps: number[] = [];
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      cps.push(b);
      i += 1;
      continue;
    }
    let need: number;
    let cp: number;
    if (b >= 0xc2 && b <= 0xdf) {
      need = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b <= 0xef) {
      need = 2;
      cp = b & 0x0f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      need = 3;
      cp = b & 0x07;
    } else {
      return null;
    }
    if (i + need >= bytes.length) return null;
    for (let k = 1; k <= need; k += 1) {
      const c = bytes[i + k];
      if (c < 0x80 || c > 0xbf) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    // Reject overlongs, surrogates and out-of-range code points.
    if (need === 2 && cp < 0x800) return null;
    if (need === 3 && (cp < 0x10000 || cp > 0x10ffff)) return null;
    if (cp >= 0xd800 && cp <= 0xdfff) return null;
    cps.push(cp);
    i += need + 1;
  }
  return codePointsToString(cps);
}

function decodeCp1252(bytes: Uint8Array): string {
  const cps: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    const b = bytes[i];
    cps.push(b >= 0x80 && b <= 0x9f ? CP1252_HIGH[b - 0x80] : b);
  }
  return codePointsToString(cps);
}

function decodeUtf16(bytes: Uint8Array, littleEndian: boolean): string {
  const units: number[] = [];
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    units.push(littleEndian ? bytes[i] | (bytes[i + 1] << 8) : (bytes[i] << 8) | bytes[i + 1]);
  }
  let out = '';
  for (let i = 0; i < units.length; i += CHUNK) {
    // fromCharCode preserves surrogate pairs, so astral planes survive.
    out += String.fromCharCode(...units.slice(i, i + CHUNK));
  }
  return out;
}

/**
 * Decode subtitle file bytes to text: BOM sniff first, then strict UTF-8,
 * then CP1252 as the catch-all. CP1252 never fails, so this always returns
 * something readable rather than throwing.
 */
export function decodeSubtitleBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const body = bytes.subarray(3);
    return decodeUtf8(body) ?? decodeCp1252(body);
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return decodeUtf16(bytes.subarray(2), true);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return decodeUtf16(bytes.subarray(2), false);
  }
  return decodeUtf8(bytes) ?? decodeCp1252(bytes);
}
