# External Subtitles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play external subtitle files (`.srt`, `.vtt`, `.ass`/`.ssa`) that sit next to a video — auto-detected, rendered by us, with a live delay slider for sync and one global text-size control.

**Architecture:** `expo-video` cannot attach an external subtitle file, so we parse the file in JS into a sorted `Cue[]` and render our own text overlay above `VideoView`, driven by a 150 ms ticker reading `player.currentTime`. All parsing, encoding detection, filename matching, and cue lookup are pure functions under `src/subtitles/` with Jest tests; the single stateful piece is a `useSubtitles` hook that `player.tsx` consumes. Reading a non-media file on Android 13+ needs `MANAGE_EXTERNAL_STORAGE`, detected by probing a directory listing rather than by writing native code.

**Tech Stack:** Expo SDK 56 / React Native 0.85, `expo-file-system` (new `File`/`Directory` API), `expo-intent-launcher` (new dep), `expo-sqlite`, `react-native-gesture-handler` + `react-native-reanimated`, Jest for pure helpers.

**Spec:** [docs/superpowers/specs/2026-08-16-external-subtitles-design.md](../specs/2026-08-16-external-subtitles-design.md)

## Global Constraints

- **Android-only**, Expo SDK 56. Read https://docs.expo.dev/versions/v56.0.0/ before writing SDK code if unsure. The `expo-file-system` surface (`File.bytes()`, `File.pickFileAsync`, `Directory.list()`) is new in recent SDKs — **verify sync vs async and exact option shapes against the v56 docs before writing Task 8/9 code**, and adjust the code in this plan to match what the docs say.
- **Package manager is `bun`.** Install deps with `bunx expo install <pkg>`. Tests: `npm test`. Typecheck: `npx tsc --noEmit` (must stay clean).
- **Testing convention (lean):** pure logic gets Jest tests; React/native UI is verified by `tsc` + a device build. UI tasks gate on `tsc`, not Jest.
- **Task 8 adds a native permission and a native dependency.** From that point the dev client must be rebuilt (`npm run android`) — JS reload is not enough. Tasks 1–7 are pure JS and need no rebuild.
- Commits are conventional commits, ending with the trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` (matches recent history).
- Path alias `@/` maps to `src/`. Tests live in `__tests__/` beside the module, named `<module>.test.ts`.
- Player chrome is **outside Material You by design** (HANDOFF §4): fixed colours over arbitrary video frames, `ON_ARTWORK` tokens from `@/theme/resolve-theme`. Non-player UI uses `useTheme()` with `?? fallback` defensively.
- **Gesture discipline (non-negotiable):** any interactive control inside the player uses a raw `Gesture.Tap`/`Gesture.Pan` and calls `.blocksExternalGesture(...usePlayerGestureRelations())`. Never RNGH `Pressable`, never an `@expo/ui` native control. See the wedge history in [player-pressable-scale.tsx](../../../src/components/player/player-pressable-scale.tsx).
- **Delay sign convention, used everywhere:** `delayMs > 0` means subtitles appear **later**. Lookup time is `videoTimeMs - delayMs`.

---

### Task 1: Migration v10 + subtitle preferences repo

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/progress-repo.ts`
- Modify: `src/db/__tests__/schema.test.ts:56`
- Create: `src/db/__tests__/progress-repo-subtitle.test.ts`

**Interfaces:**
- Consumes: `SQLiteDatabase` from `expo-sqlite`.
- Produces: `SubtitlePrefs { uri: string | null; delayMs: number }`, `getSubtitlePrefs(db, videoId): Promise<SubtitlePrefs>`, `setSubtitlePrefs(db, videoId, uri, delayMs, nowMs): Promise<void>`.

- [ ] **Step 1: Add migration v10 to `src/db/schema.ts`**

  Append to the `MIGRATIONS` array:

  ```ts
  {
    version: 10,
    up: `
      ALTER TABLE watch_progress ADD COLUMN subtitle_uri TEXT;
      ALTER TABLE watch_progress ADD COLUMN subtitle_delay_ms INTEGER NOT NULL DEFAULT 0;
    `,
  },
  ```

  Change `export const LATEST_VERSION = 9;` to `= 10;`.

- [ ] **Step 2: Fix the stale assertion in `src/db/__tests__/schema.test.ts`**

  The migration-9 test ends with `expect(LATEST_VERSION).toBe(9);` — a misplaced assertion that breaks on every future bump. Delete that one line. The first test in the file (`LATEST_VERSION matches the highest migration version`) already covers the invariant properly.

  Then add a v10 test alongside the other per-migration tests:

  ```ts
  it('migration 10 adds subtitle columns to watch_progress', () => {
    const m10 = MIGRATIONS.find((m) => m.version === 10);
    expect(m10).toBeDefined();
    expect(m10!.up).toContain('ALTER TABLE watch_progress ADD COLUMN subtitle_uri TEXT');
    expect(m10!.up).toContain(
      'ALTER TABLE watch_progress ADD COLUMN subtitle_delay_ms INTEGER NOT NULL DEFAULT 0',
    );
  });
  ```

- [ ] **Step 3: Run the schema tests**

  Run: `npm test -- schema`
  Expected: PASS.

- [ ] **Step 4: Write the failing repo test**

  Create `src/db/__tests__/progress-repo-subtitle.test.ts`. This mirrors the existing `progress-repo-display-mode.test.ts` fake-db pattern exactly:

  ```ts
  import { getSubtitlePrefs, setSubtitlePrefs, upsertProgress } from '../progress-repo';
  import type { SQLiteDatabase } from 'expo-sqlite';

  function makeFakeDb() {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    let firstResult: unknown = null;
    const db = {
      async runAsync(sql: string, params: unknown[]) {
        calls.push({ sql, params });
      },
      async getFirstAsync(sql: string, params: unknown[]) {
        calls.push({ sql, params });
        return firstResult;
      },
    } as unknown as SQLiteDatabase;
    return { db, calls, setFirstResult: (r: unknown) => (firstResult = r) };
  }

  describe('getSubtitlePrefs', () => {
    it('returns the stored uri and delay', async () => {
      const { db, setFirstResult } = makeFakeDb();
      setFirstResult({ subtitle_uri: 'file:///a/b.srt', subtitle_delay_ms: 250 });
      expect(await getSubtitlePrefs(db, 'v1')).toEqual({ uri: 'file:///a/b.srt', delayMs: 250 });
    });

    it('defaults to no subtitle and zero delay when there is no row', async () => {
      const { db } = makeFakeDb();
      expect(await getSubtitlePrefs(db, 'v1')).toEqual({ uri: null, delayMs: 0 });
    });
  });

  describe('setSubtitlePrefs', () => {
    it('upserts both columns with defaults for a missing row', async () => {
      const { db, calls } = makeFakeDb();
      await setSubtitlePrefs(db, 'v1', 'file:///a/b.srt', -500, 123);
      expect(calls[0].sql).toContain('INSERT INTO watch_progress');
      expect(calls[0].sql).toContain('subtitle_uri = excluded.subtitle_uri');
      expect(calls[0].sql).toContain('subtitle_delay_ms = excluded.subtitle_delay_ms');
      expect(calls[0].params).toEqual(['v1', 123, 'file:///a/b.srt', -500]);
    });

    it('writes NULL to clear the subtitle', async () => {
      const { db, calls } = makeFakeDb();
      await setSubtitlePrefs(db, 'v1', null, 0, 123);
      expect(calls[0].params).toEqual(['v1', 123, null, 0]);
    });
  });

  // Migration v9 exists because `completed` was being clobbered by
  // excluded.completed on every progress write. The subtitle columns must
  // never join that SET list, or the same class of bug returns.
  describe('upsertProgress', () => {
    it('never touches the subtitle columns', async () => {
      const { db, calls } = makeFakeDb();
      await upsertProgress(db, 'v1', {
        positionMs: 1000,
        percent: 0.5,
        completed: false,
        lastPlayedAt: 123,
      });
      expect(calls[0].sql).not.toContain('subtitle_uri');
      expect(calls[0].sql).not.toContain('subtitle_delay_ms');
    });
  });
  ```

- [ ] **Step 5: Run it to verify it fails**

  Run: `npm test -- progress-repo-subtitle`
  Expected: FAIL — `getSubtitlePrefs is not a function`.

- [ ] **Step 6: Implement the repo functions**

  Append to `src/db/progress-repo.ts`, directly below `setDisplayMode` (same upsert discipline, same reason):

  ```ts
  export interface SubtitlePrefs {
    /** file:// URI of the external subtitle, or null when none is chosen. */
    uri: string | null;
    /** Positive = subtitles appear later. */
    delayMs: number;
  }

  export async function getSubtitlePrefs(
    db: SQLiteDatabase,
    videoId: string,
  ): Promise<SubtitlePrefs> {
    const row = await db.getFirstAsync<{
      subtitle_uri: string | null;
      subtitle_delay_ms: number | null;
    }>('SELECT subtitle_uri, subtitle_delay_ms FROM watch_progress WHERE video_id = ?', [videoId]);
    return { uri: row?.subtitle_uri ?? null, delayMs: row?.subtitle_delay_ms ?? 0 };
  }

  // Upsert with the same shape as setDisplayMode: a fresh video may have no
  // progress row yet. Naming only the subtitle columns in ON CONFLICT keeps
  // progress writes and subtitle writes from clobbering each other.
  export async function setSubtitlePrefs(
    db: SQLiteDatabase,
    videoId: string,
    uri: string | null,
    delayMs: number,
    nowMs: number,
  ): Promise<void> {
    await db.runAsync(
      `INSERT INTO watch_progress (video_id, position_ms, percent, completed, last_played_at, subtitle_uri, subtitle_delay_ms)
       VALUES (?, 0, 0, 0, ?, ?, ?)
       ON CONFLICT(video_id) DO UPDATE SET
         subtitle_uri = excluded.subtitle_uri,
         subtitle_delay_ms = excluded.subtitle_delay_ms`,
      [videoId, nowMs, uri, delayMs],
    );
  }
  ```

- [ ] **Step 7: Run tests and typecheck**

  Run: `npm test -- progress-repo-subtitle && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 8: Commit**

  ```bash
  git add src/db
  git commit -m "$(cat <<'EOF'
  feat(db): migration v10 — per-video subtitle uri + delay

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Cue types + encoding detection

Real-world subtitle files are frequently not UTF-8 — Windows-1252 is everywhere in Western European subs — and a naive UTF-8 read turns every accented character into replacement junk. Do not assume `TextDecoder` exists or supports non-UTF-8 labels in this Hermes build; everything here is hand-rolled and dependency-free.

**Files:**
- Create: `src/subtitles/types.ts`
- Create: `src/subtitles/decode-text.ts`
- Test: `src/subtitles/__tests__/decode-text.test.ts`

**Interfaces:**
- Produces: `Cue`, `SubtitleFormat`, `SubtitleCandidate`, `LoadedSubtitle`, `decodeSubtitleBytes(bytes: Uint8Array): string`.

- [ ] **Step 1: Create `src/subtitles/types.ts`**

  ```ts
  /** A single displayable subtitle line. `text` may contain newlines. */
  export interface Cue {
    startMs: number;
    endMs: number;
    text: string;
  }

  export type SubtitleFormat = 'srt' | 'vtt' | 'ass';

  /** A subtitle file found next to the video, before it has been loaded. */
  export interface SubtitleCandidate {
    /** Path relative to the video's folder: 'Movie.en.srt' or 'Subs/2_English.srt'. */
    relativePath: string;
    /** Basename with extension, shown in the tracks sheet. */
    name: string;
    /** 0 = best match. See find-sibling's ranking table. */
    rank: number;
    /** Lowercased language token from the filename ('en', 'eng'), else null. */
    lang: string | null;
  }

  /** A subtitle file that has been read, decoded and parsed. */
  export interface LoadedSubtitle {
    uri: string;
    name: string;
    cues: Cue[];
  }
  ```

- [ ] **Step 2: Write the failing test**

  Create `src/subtitles/__tests__/decode-text.test.ts`:

  ```ts
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
      expect(decodeSubtitleBytes(bytes(0x49, 0x92, 0x6d))).toBe('I’m');
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
  ```

- [ ] **Step 3: Run it to verify it fails**

  Run: `npm test -- decode-text`
  Expected: FAIL — cannot find module `../decode-text`.

- [ ] **Step 4: Implement `src/subtitles/decode-text.ts`**

  ```ts
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
  ```

- [ ] **Step 5: Run tests and typecheck**

  Run: `npm test -- decode-text && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 6: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): cue types + encoding detection with CP1252 fallback

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: Timecodes, tag stripping, and the SRT/VTT parsers

SRT and WebVTT differ only in a header, some metadata blocks, and `,` vs `.` before the milliseconds. One shared block scanner serves both.

**Files:**
- Create: `src/subtitles/timestamp.ts`
- Create: `src/subtitles/strip-tags.ts`
- Create: `src/subtitles/parse-cue-blocks.ts`
- Create: `src/subtitles/parse-srt.ts`
- Create: `src/subtitles/parse-vtt.ts`
- Test: `src/subtitles/__tests__/parse-srt.test.ts`
- Test: `src/subtitles/__tests__/parse-vtt.test.ts`

**Interfaces:**
- Consumes: `Cue` from `./types`.
- Produces: `parseTimecode(raw: string): number | null`, `stripInlineTags(text: string): string`, `parseCueBlocks(text: string): Cue[]`, `parseSrt(text: string): Cue[]`, `parseVtt(text: string): Cue[]`.

- [ ] **Step 1: Write the failing SRT test**

  Create `src/subtitles/__tests__/parse-srt.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Write the failing VTT test**

  Create `src/subtitles/__tests__/parse-vtt.test.ts`:

  ```ts
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
  ```

- [ ] **Step 3: Run both to verify they fail**

  Run: `npm test -- parse-srt parse-vtt`
  Expected: FAIL — cannot find modules.

- [ ] **Step 4: Implement `src/subtitles/timestamp.ts`**

  ```ts
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
  ```

- [ ] **Step 5: Implement `src/subtitles/strip-tags.ts`**

  ```ts
  /**
   * Remove inline markup that we deliberately do not render: SRT/VTT HTML-ish
   * tags (<i>, <b>, <v Roger>) and ASS override blocks ({\pos(...)}, {\c&H..}).
   * ASS line breaks (\N, \n) become real newlines and \h becomes a space.
   *
   * Italics are dropped rather than rendered: a rich-text renderer is not worth
   * it for subtitle emphasis.
   */
  export function stripInlineTags(text: string): string {
    return text
      .replace(/\{[^}]*\}/g, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\\N/g, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\h/g, ' ');
  }
  ```

- [ ] **Step 6: Implement `src/subtitles/parse-cue-blocks.ts`**

  ```ts
  import type { Cue } from './types';
  import { parseTimecode } from './timestamp';
  import { stripInlineTags } from './strip-tags';

  /**
   * The shared SRT/VTT block scanner. It looks only for lines containing
   * '-->', so sequence numbers and VTT cue identifiers are skipped for free.
   */
  export function parseCueBlocks(text: string): Cue[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cues: Cue[] = [];
    let i = 0;

    while (i < lines.length) {
      if (!lines[i].includes('-->')) {
        i += 1;
        continue;
      }
      const [rawStart, rawRest] = lines[i].split('-->');
      const startMs = parseTimecode(rawStart);
      // VTT cue settings (align:start line:90%) trail the end timestamp.
      const endMs = parseTimecode((rawRest ?? '').trim().split(/\s+/)[0] ?? '');
      i += 1;

      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].includes('-->')) {
        textLines.push(lines[i]);
        i += 1;
      }
      // A missing blank line before the next cue leaves that cue's sequence
      // number stuck on the end of this one's text. Drop it.
      if (
        i < lines.length &&
        lines[i].includes('-->') &&
        textLines.length > 0 &&
        /^\d+$/.test(textLines[textLines.length - 1].trim())
      ) {
        textLines.pop();
      }

      if (startMs === null || endMs === null || endMs <= startMs) continue;
      const body = stripInlineTags(textLines.join('\n')).trim();
      if (body) cues.push({ startMs, endMs, text: body });
    }

    return cues.sort((a, b) => a.startMs - b.startMs);
  }
  ```

- [ ] **Step 7: Implement `src/subtitles/parse-srt.ts`**

  ```ts
  import type { Cue } from './types';
  import { parseCueBlocks } from './parse-cue-blocks';

  export function parseSrt(text: string): Cue[] {
    return parseCueBlocks(text);
  }
  ```

- [ ] **Step 8: Implement `src/subtitles/parse-vtt.ts`**

  ```ts
  import type { Cue } from './types';
  import { parseCueBlocks } from './parse-cue-blocks';

  /**
   * Strip the WEBVTT header and the NOTE/STYLE/REGION blocks, each of which
   * runs until the next blank line. What remains is SRT-shaped.
   */
  export function stripVttBlocks(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const out: string[] = [];
    let skipping = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (/^WEBVTT/.test(trimmed) || /^(NOTE|STYLE|REGION)\b/.test(trimmed)) {
        skipping = true;
        continue;
      }
      if (skipping) {
        if (trimmed === '') skipping = false;
        continue;
      }
      out.push(line);
    }
    return out.join('\n');
  }

  export function parseVtt(text: string): Cue[] {
    return parseCueBlocks(stripVttBlocks(text));
  }
  ```

- [ ] **Step 9: Run tests and typecheck**

  Run: `npm test -- parse-srt parse-vtt && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 10: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): SRT and WebVTT parsers on a shared block scanner

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: ASS/SSA parser (text only)

ASS is effectively a layout engine; we take the dialogue and discard the typesetting. Positioning is deliberately lost — signs render as plain lines alongside dialogue. Never assume fixed column positions: the `Format:` line defines them and real files reorder them.

**Files:**
- Create: `src/subtitles/parse-ass.ts`
- Test: `src/subtitles/__tests__/parse-ass.test.ts`

**Interfaces:**
- Consumes: `Cue` from `./types`, `parseTimecode`, `stripInlineTags`.
- Produces: `parseAss(text: string): Cue[]`.

- [ ] **Step 1: Write the failing test**

  Create `src/subtitles/__tests__/parse-ass.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run it to verify it fails**

  Run: `npm test -- parse-ass`
  Expected: FAIL — cannot find module `../parse-ass`.

- [ ] **Step 3: Implement `src/subtitles/parse-ass.ts`**

  ```ts
  import type { Cue } from './types';
  import { parseTimecode } from './timestamp';
  import { stripInlineTags } from './strip-tags';

  /**
   * Split on `sep`, but stop after `limit` fields so the final field keeps any
   * separators it contains. ASS puts Text last precisely because it has commas.
   */
  function splitLimit(source: string, sep: string, limit: number): string[] {
    const parts: string[] = [];
    let idx = 0;
    while (parts.length < limit - 1) {
      const next = source.indexOf(sep, idx);
      if (next === -1) break;
      parts.push(source.slice(idx, next));
      idx = next + 1;
    }
    parts.push(source.slice(idx));
    return parts;
  }

  /**
   * Parse ASS/SSA dialogue as plain text. Positioning, colours, fonts and
   * karaoke are discarded by design (see the spec): signs and typesetting come
   * out as ordinary bottom-centred lines.
   */
  export function parseAss(text: string): Cue[] {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const cues: Cue[] = [];
    let inEvents = false;
    let idxStart = -1;
    let idxEnd = -1;
    let idxText = -1;
    let fieldCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('[')) {
        inEvents = /^\[events\]/i.test(trimmed);
        // Column indices belong to the section that declared them.
        idxStart = -1;
        idxEnd = -1;
        idxText = -1;
        continue;
      }
      if (!inEvents) continue;

      if (/^Format\s*:/i.test(trimmed)) {
        const fields = trimmed
          .slice(trimmed.indexOf(':') + 1)
          .split(',')
          .map((f) => f.trim().toLowerCase());
        idxStart = fields.indexOf('start');
        idxEnd = fields.indexOf('end');
        idxText = fields.indexOf('text');
        fieldCount = fields.length;
        continue;
      }

      if (!/^Dialogue\s*:/i.test(trimmed)) continue;
      if (idxStart < 0 || idxEnd < 0 || idxText < 0) continue;

      const parts = splitLimit(trimmed.slice(trimmed.indexOf(':') + 1), ',', fieldCount);
      const startMs = parseTimecode(parts[idxStart] ?? '');
      const endMs = parseTimecode(parts[idxEnd] ?? '');
      const raw = parts[idxText] ?? '';

      if (startMs === null || endMs === null || endMs <= startMs) continue;
      // {\p1} switches the renderer into vector-drawing mode; the "text" that
      // follows is a list of coordinates and would render as garbage.
      if (/\{[^}]*\\p[1-9]/.test(raw)) continue;

      const body = stripInlineTags(raw).trim();
      if (body) cues.push({ startMs, endMs, text: body });
    }

    return cues.sort((a, b) => a.startMs - b.startMs);
  }
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `npm test -- parse-ass && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 5: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): ASS/SSA parser rendering dialogue as plain text

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: Format dispatch

**Files:**
- Create: `src/subtitles/parse-subtitle.ts`
- Test: `src/subtitles/__tests__/parse-subtitle.test.ts`

**Interfaces:**
- Consumes: `parseSrt`, `parseVtt`, `parseAss`, `SubtitleFormat`, `Cue`.
- Produces: `SUBTITLE_EXTENSIONS`, `MAX_SUBTITLE_BYTES`, `subtitleFormatOf(name: string): SubtitleFormat | null`, `parseSubtitle(name: string, text: string): Cue[]`.

- [ ] **Step 1: Write the failing test**

  Create `src/subtitles/__tests__/parse-subtitle.test.ts`:

  ```ts
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
  ```

- [ ] **Step 2: Run it to verify it fails**

  Run: `npm test -- parse-subtitle`
  Expected: FAIL — cannot find module `../parse-subtitle`.

- [ ] **Step 3: Implement `src/subtitles/parse-subtitle.ts`**

  ```ts
  import type { Cue, SubtitleFormat } from './types';
  import { parseSrt } from './parse-srt';
  import { parseVtt } from './parse-vtt';
  import { parseAss } from './parse-ass';

  export const SUBTITLE_EXTENSIONS = ['srt', 'vtt', 'ass', 'ssa'] as const;

  /**
   * Refuse absurd files. ASS with an embedded [Fonts] section can run to
   * megabytes, and no legitimate dialogue track is this big. Enforced by
   * load-subtitle, which is where the byte count is known.
   */
  export const MAX_SUBTITLE_BYTES = 10 * 1024 * 1024;

  export function subtitleFormatOf(name: string): SubtitleFormat | null {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return null;
    const ext = name.slice(dot + 1).toLowerCase();
    if (ext === 'srt') return 'srt';
    if (ext === 'vtt') return 'vtt';
    if (ext === 'ass' || ext === 'ssa') return 'ass';
    return null;
  }

  export function parseSubtitle(name: string, text: string): Cue[] {
    switch (subtitleFormatOf(name)) {
      case 'srt':
        return parseSrt(text);
      case 'vtt':
        return parseVtt(text);
      case 'ass':
        return parseAss(text);
      default:
        return [];
    }
  }
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `npm test -- parse-subtitle && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 5: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): format dispatch by file extension

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Sibling file matching

Pure ranking over a directory listing. The impure directory walk arrives in Task 9.

**Files:**
- Create: `src/subtitles/find-sibling.ts`
- Test: `src/subtitles/__tests__/find-sibling.test.ts`

**Interfaces:**
- Consumes: `SubtitleCandidate` from `./types`, `subtitleFormatOf` from `./parse-subtitle`.
- Produces: `DirectoryEntry { name: string; isDirectory: boolean }`, `SubsFolder { name: string; entries: DirectoryEntry[] }`, `findSubtitleCandidates(videoName, folderEntries, subsFolder): SubtitleCandidate[]`, `pickAutoLoad(candidates, deviceLang): SubtitleCandidate | null`.

- [ ] **Step 1: Write the failing test**

  Create `src/subtitles/__tests__/find-sibling.test.ts`:

  ```ts
  import { findSubtitleCandidates, pickAutoLoad } from '../find-sibling';
  import type { DirectoryEntry } from '../find-sibling';

  function files(...names: string[]): DirectoryEntry[] {
    return names.map((name) => ({ name, isDirectory: false }));
  }

  describe('findSubtitleCandidates', () => {
    it('ranks an exact basename match best', () => {
      const found = findSubtitleCandidates('Movie.mkv', files('Movie.mkv', 'Movie.srt'), null);
      expect(found).toEqual([
        { relativePath: 'Movie.srt', name: 'Movie.srt', rank: 0, lang: null },
      ]);
    });

    it('ranks language-suffixed files just below', () => {
      const found = findSubtitleCandidates('Movie.mkv', files('Movie.en.srt', 'Movie.eng.srt'), null);
      expect(found.map((c) => [c.name, c.rank, c.lang])).toEqual([
        ['Movie.en.srt', 1, 'en'],
        ['Movie.eng.srt', 1, 'eng'],
      ]);
    });

    it('ranks forced and SDH below full tracks', () => {
      const found = findSubtitleCandidates(
        'Movie.mkv',
        files('Movie.en.forced.srt', 'Movie.forced.srt', 'Movie.en.sdh.srt'),
        null,
      );
      expect(found.every((c) => c.rank === 2)).toBe(true);
    });

    it('ranks other prefix matches last', () => {
      const found = findSubtitleCandidates('Movie.mkv', files('Movie - Track 2.srt'), null);
      expect(found[0].rank).toBe(3);
    });

    it('ignores unrelated names and non-subtitle files', () => {
      const found = findSubtitleCandidates(
        'Movie.mkv',
        files('Other.srt', 'Movie.mkv', 'Movie.nfo', 'notes.txt'),
        null,
      );
      expect(found).toEqual([]);
    });

    it('matches case-insensitively', () => {
      const found = findSubtitleCandidates('MOVIE.mkv', files('movie.SRT'), null);
      expect(found[0].rank).toBe(0);
    });

    it('skips directories', () => {
      const entries = [...files('Movie.srt'), { name: 'Movie.srt.d', isDirectory: true }];
      expect(findSubtitleCandidates('Movie.mkv', entries, null)).toHaveLength(1);
    });

    it('takes every subtitle in Subs/ when the folder holds exactly one video', () => {
      const found = findSubtitleCandidates('Movie.mkv', files('Movie.mkv'), {
        name: 'Subs',
        entries: files('2_English.srt', '3_Spanish.srt'),
      });
      expect(found.map((c) => [c.relativePath, c.rank])).toEqual([
        ['Subs/2_English.srt', 4],
        ['Subs/3_Spanish.srt', 4],
      ]);
    });

    it('does NOT take unmatched Subs/ files when the folder holds several videos', () => {
      const found = findSubtitleCandidates('S01E01.mkv', files('S01E01.mkv', 'S01E02.mkv'), {
        name: 'Subs',
        entries: files('2_English.srt'),
      });
      expect(found).toEqual([]);
    });

    it('still name-matches inside Subs/ when the folder holds several videos', () => {
      const found = findSubtitleCandidates('S01E01.mkv', files('S01E01.mkv', 'S01E02.mkv'), {
        name: 'Subs',
        entries: files('S01E01.en.srt', 'S01E02.en.srt'),
      });
      expect(found.map((c) => c.relativePath)).toEqual(['Subs/S01E01.en.srt']);
    });

    it('sorts by rank then name', () => {
      const found = findSubtitleCandidates(
        'Movie.mkv',
        files('Movie - extra.srt', 'Movie.fr.srt', 'Movie.srt', 'Movie.en.srt'),
        null,
      );
      expect(found.map((c) => c.name)).toEqual([
        'Movie.srt',
        'Movie.en.srt',
        'Movie.fr.srt',
        'Movie - extra.srt',
      ]);
    });
  });

  describe('pickAutoLoad', () => {
    const cand = (name: string, rank: number, lang: string | null) => ({
      relativePath: name,
      name,
      rank,
      lang,
    });

    it('returns null for no candidates', () => {
      expect(pickAutoLoad([], 'en')).toBeNull();
    });

    it('prefers the best rank', () => {
      expect(pickAutoLoad([cand('b.srt', 3, null), cand('a.srt', 0, null)], 'en')!.name).toBe('a.srt');
    });

    it('prefers a plain name over a language-suffixed one within a rank', () => {
      const picked = pickAutoLoad([cand('Movie.en.srt', 1, 'en'), cand('Movie.srt', 1, null)], 'en');
      expect(picked!.name).toBe('Movie.srt');
    });

    it('prefers the device language when every candidate is language-tagged', () => {
      const picked = pickAutoLoad([cand('a.fr.srt', 1, 'fr'), cand('b.en.srt', 1, 'en')], 'en');
      expect(picked!.name).toBe('b.en.srt');
    });

    it('matches a three-letter language token against a two-letter device locale', () => {
      const picked = pickAutoLoad([cand('a.fr.srt', 1, 'fr'), cand('b.eng.srt', 1, 'eng')], 'en');
      expect(picked!.name).toBe('b.eng.srt');
    });

    it('falls back to alphabetical when nothing matches the device language', () => {
      const picked = pickAutoLoad([cand('z.de.srt', 1, 'de'), cand('a.fr.srt', 1, 'fr')], 'en');
      expect(picked!.name).toBe('a.fr.srt');
    });
  });
  ```

- [ ] **Step 2: Run it to verify it fails**

  Run: `npm test -- find-sibling`
  Expected: FAIL — cannot find module `../find-sibling`.

- [ ] **Step 3: Implement `src/subtitles/find-sibling.ts`**

  ```ts
  import type { SubtitleCandidate } from './types';
  import { subtitleFormatOf } from './parse-subtitle';

  export interface DirectoryEntry {
    name: string;
    isDirectory: boolean;
  }

  /** A `Subs/` or `Subtitles/` subfolder of the video's own folder. */
  export interface SubsFolder {
    name: string;
    entries: DirectoryEntry[];
  }

  /** Folder names we look inside, in addition to the video's own folder. */
  export const SUBS_FOLDER_NAMES = ['subs', 'subtitles'];

  const VIDEO_EXTENSIONS = [
    'mp4', 'mkv', 'avi', 'mov', 'm4v', 'webm', 'ts', 'flv', 'wmv', '3gp', 'mpg', 'mpeg',
  ];

  /** Tokens that mark a partial or accessibility track rather than a full one. */
  const FLAG_TOKENS = ['forced', 'sdh', 'cc', 'hi'];

  function stripExt(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot < 0 ? name : name.slice(0, dot);
  }

  function isVideoName(name: string): boolean {
    const dot = name.lastIndexOf('.');
    return dot >= 0 && VIDEO_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
  }

  /**
   * Rank a subtitle filename against the video's basename. Returns null when
   * the name is unrelated. Both arguments are already lowercased and
   * extension-stripped.
   */
  function rankName(candidate: string, base: string): { rank: number; lang: string | null } | null {
    if (candidate === base) return { rank: 0, lang: null };
    if (!candidate.startsWith(base)) return null;

    const suffix = candidate.slice(base.length);
    // Require a real separator so 'Movie2.srt' does not match 'Movie'.
    if (!/^[._\- ]/.test(suffix)) return null;

    const tokens = suffix.slice(1).split('.').filter(Boolean);
    const flags = tokens.filter((t) => FLAG_TOKENS.includes(t));
    const langs = tokens.filter((t) => /^[a-z]{2,3}$/.test(t) && !FLAG_TOKENS.includes(t));

    // Only claim rank 1 or 2 when every token is accounted for; anything else
    // is an arbitrary suffix and belongs in rank 3.
    if (tokens.length > 0 && tokens.every((t) => flags.includes(t) || langs.includes(t))) {
      // Forced/SDH tracks carry only foreign-language or accessibility lines.
      // Auto-loading one over a full track looks like broken subtitles, so
      // they always rank below.
      if (flags.length > 0) return { rank: 2, lang: langs[0] ?? null };
      if (langs.length > 0) return { rank: 1, lang: langs[0] };
    }
    return { rank: 3, lang: langs[0] ?? null };
  }

  export function findSubtitleCandidates(
    videoName: string,
    folderEntries: DirectoryEntry[],
    subsFolder: SubsFolder | null,
  ): SubtitleCandidate[] {
    const base = stripExt(videoName).toLowerCase();
    const found: SubtitleCandidate[] = [];

    for (const entry of folderEntries) {
      if (entry.isDirectory || !subtitleFormatOf(entry.name)) continue;
      const ranked = rankName(stripExt(entry.name).toLowerCase(), base);
      if (!ranked) continue;
      found.push({ relativePath: entry.name, name: entry.name, rank: ranked.rank, lang: ranked.lang });
    }

    if (subsFolder) {
      // Scene releases fill Subs/ with names like '2_English.srt' that match
      // nothing. Accepting those is only safe when the folder holds a single
      // video — otherwise we would hand episode 1 episode 2's subtitles.
      const videoCount = folderEntries.filter((e) => !e.isDirectory && isVideoName(e.name)).length;
      for (const entry of subsFolder.entries) {
        if (entry.isDirectory || !subtitleFormatOf(entry.name)) continue;
        const ranked = rankName(stripExt(entry.name).toLowerCase(), base);
        const rank = ranked ? ranked.rank : videoCount === 1 ? 4 : null;
        if (rank === null) continue;
        found.push({
          relativePath: `${subsFolder.name}/${entry.name}`,
          name: entry.name,
          rank,
          lang: ranked?.lang ?? null,
        });
      }
    }

    return found.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  }

  /**
   * Choose which candidate loads automatically: best rank wins, then a plain
   * name beats a language-tagged one, then the device language, then
   * alphabetical. Fully deterministic — every candidate is still listed in the
   * tracks sheet, so a wrong guess is one tap from being corrected.
   */
  export function pickAutoLoad(
    candidates: SubtitleCandidate[],
    deviceLang: string,
  ): SubtitleCandidate | null {
    if (candidates.length === 0) return null;
    const byName = (a: SubtitleCandidate, b: SubtitleCandidate) => a.name.localeCompare(b.name);

    const best = Math.min(...candidates.map((c) => c.rank));
    const tier = candidates.filter((c) => c.rank === best);

    const plain = tier.filter((c) => c.lang === null);
    if (plain.length > 0) return plain.sort(byName)[0];

    const short = deviceLang.toLowerCase().slice(0, 2);
    const local = tier.filter((c) => c.lang !== null && c.lang.slice(0, 2) === short);
    if (local.length > 0) return local.sort(byName)[0];

    return tier.slice().sort(byName)[0];
  }
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `npm test -- find-sibling && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 5: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): rank sibling subtitle files and pick one to auto-load

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Cue lookup

**Files:**
- Create: `src/subtitles/active-cue.ts`
- Test: `src/subtitles/__tests__/active-cue.test.ts`

**Interfaces:**
- Consumes: `Cue` from `./types`.
- Produces: `activeCues(cues, timeMs, delayMs, max?): Cue[]`, `cueTextOf(cues: Cue[]): string`.

- [ ] **Step 1: Write the failing test**

  Create `src/subtitles/__tests__/active-cue.test.ts`:

  ```ts
  import { activeCues, cueTextOf } from '../active-cue';
  import type { Cue } from '../types';

  const CUES: Cue[] = [
    { startMs: 1000, endMs: 2000, text: 'One' },
    { startMs: 3000, endMs: 4000, text: 'Two' },
    { startMs: 5000, endMs: 6000, text: 'Three' },
  ];

  describe('activeCues', () => {
    it('finds the cue covering the time', () => {
      expect(activeCues(CUES, 3500, 0).map((c) => c.text)).toEqual(['Two']);
    });

    it('treats start as inclusive and end as exclusive', () => {
      expect(activeCues(CUES, 3000, 0).map((c) => c.text)).toEqual(['Two']);
      expect(activeCues(CUES, 4000, 0)).toEqual([]);
    });

    it('returns nothing in the gaps, before the first cue, and after the last', () => {
      expect(activeCues(CUES, 2500, 0)).toEqual([]);
      expect(activeCues(CUES, 0, 0)).toEqual([]);
      expect(activeCues(CUES, 99000, 0)).toEqual([]);
    });

    it('returns an empty array for no cues', () => {
      expect(activeCues([], 1000, 0)).toEqual([]);
    });

    it('shifts subtitles later for a positive delay', () => {
      // +1000ms means the line that played at 3500 now plays at 4500.
      expect(activeCues(CUES, 4500, 1000).map((c) => c.text)).toEqual(['Two']);
      expect(activeCues(CUES, 3500, 1000)).toEqual([]);
    });

    it('shifts subtitles earlier for a negative delay', () => {
      expect(activeCues(CUES, 2500, -1000).map((c) => c.text)).toEqual(['Two']);
    });

    it('handles a delay that pushes lookup below zero or past the end', () => {
      expect(activeCues(CUES, 500, 60000)).toEqual([]);
      expect(activeCues(CUES, 1500, -60000)).toEqual([]);
    });

    it('returns overlapping cues in start order', () => {
      const overlapping: Cue[] = [
        { startMs: 1000, endMs: 9000, text: 'Sign' },
        { startMs: 2000, endMs: 3000, text: 'Dialogue' },
      ];
      expect(activeCues(overlapping, 2500, 0).map((c) => c.text)).toEqual(['Sign', 'Dialogue']);
    });

    it('caps the number of simultaneous cues', () => {
      const many: Cue[] = [0, 1, 2, 3, 4].map((i) => ({
        startMs: i * 10,
        endMs: 100000,
        text: `c${i}`,
      }));
      expect(activeCues(many, 500, 0)).toHaveLength(3);
    });
  });

  describe('cueTextOf', () => {
    it('joins cues with newlines', () => {
      expect(cueTextOf(CUES.slice(0, 2))).toBe('One\nTwo');
    });

    it('is empty for no cues', () => {
      expect(cueTextOf([])).toBe('');
    });
  });
  ```

- [ ] **Step 2: Run it to verify it fails**

  Run: `npm test -- active-cue`
  Expected: FAIL — cannot find module `../active-cue`.

- [ ] **Step 3: Implement `src/subtitles/active-cue.ts`**

  ```ts
  import type { Cue } from './types';

  /** How far back to walk looking for a long cue that is still on screen. */
  const MAX_LOOKBACK = 32;

  /**
   * Cues active at `timeMs`, given a delay offset. `cues` must be sorted by
   * startMs (every parser guarantees this).
   *
   * Delay convention: positive delay means subtitles appear LATER, so the
   * lookup happens at `timeMs - delayMs`.
   *
   * ASS files routinely overlap a sign with a line of dialogue, so this returns
   * an array rather than a single cue, capped at `max`.
   */
  export function activeCues(cues: Cue[], timeMs: number, delayMs: number, max = 3): Cue[] {
    if (cues.length === 0) return [];
    const t = timeMs - delayMs;

    // Binary search for the first cue starting after t.
    let lo = 0;
    let hi = cues.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cues[mid].startMs <= t) lo = mid + 1;
      else hi = mid;
    }

    // Walk back from there: an earlier long cue can still be on screen, so we
    // cannot stop at the first non-match. Bounded, since overlaps are shallow.
    const out: Cue[] = [];
    for (let i = lo - 1; i >= 0 && lo - 1 - i < MAX_LOOKBACK; i -= 1) {
      const cue = cues[i];
      if (cue.endMs > t) {
        out.unshift(cue);
        if (out.length >= max) break;
      }
    }
    return out;
  }

  export function cueTextOf(cues: Cue[]): string {
    return cues.map((c) => c.text).join('\n');
  }
  ```

- [ ] **Step 4: Run tests and typecheck**

  Run: `npm test -- active-cue && npx tsc --noEmit`
  Expected: PASS, clean.

- [ ] **Step 5: Run the whole suite to be sure nothing regressed**

  Run: `npm test`
  Expected: all PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): delay-aware binary-search cue lookup

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: All-files storage access

⚠️ **This task adds a native permission and a native dependency. From here on the dev client must be rebuilt (`npm run android`); a JS reload will not pick these up.**

**Files:**
- Modify: `app.config.ts:39-47` (the `android.permissions` array)
- Modify: `package.json` (via `bunx expo install`)
- Create: `src/subtitles/storage-access.ts`
- Create: `src/components/storage-access-sheet.tsx`

**Interfaces:**
- Consumes: `expo-file-system`, `expo-intent-launcher`, `expo-constants`.
- Produces: `canReadFolder(folderUri: string): boolean`, `openAllFilesAccessSettings(): Promise<void>`, `<StorageAccessSheet onGrant onClose />`.

- [ ] **Step 1: Read the v56 docs**

  Open https://docs.expo.dev/versions/v56.0.0/sdk/filesystem/ and https://docs.expo.dev/versions/v56.0.0/sdk/intent-launcher/. Confirm: whether `Directory.list()` is synchronous, the exact `File.pickFileAsync` options shape, and `IntentLauncher.startActivityAsync`'s signature. Adjust the code below if the docs disagree — **the docs win**.

- [ ] **Step 2: Install `expo-intent-launcher`**

  Run: `bunx expo install expo-intent-launcher`

- [ ] **Step 3: Declare the permission in `app.config.ts`**

  Add to the `android.permissions` array, after the existing entries:

  ```ts
  // Android treats .srt/.ass as non-media files, so READ_MEDIA_VIDEO does not
  // cover them. All-files access is what VLC and MX Player use for the same
  // reason. 53XY ships as a side-loaded APK, so Play Store policy review is
  // not a constraint here.
  'android.permission.MANAGE_EXTERNAL_STORAGE',
  ```

- [ ] **Step 4: Implement `src/subtitles/storage-access.ts`**

  ```ts
  import Constants from 'expo-constants';
  import { Directory } from 'expo-file-system';
  import * as IntentLauncher from 'expo-intent-launcher';

  /**
   * Whether we can actually read a folder's contents.
   *
   * There is no JS binding for Environment.isExternalStorageManager(), so
   * instead of adding native code we probe the real capability: listing the
   * folder throws when all-files access has not been granted. This tests what
   * we care about rather than a proxy for it. If a particular OEM ROM makes
   * this unreliable, the fallback is an isExternalStorageManager() binding in
   * the existing modules/share-media Kotlin module — that swap touches only
   * this file.
   */
  export function canReadFolder(folderUri: string): boolean {
    try {
      new Directory(folderUri).list();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Open the system screen holding the All files access toggle, deep-linked to
   * this app rather than the generic list.
   */
  export async function openAllFilesAccessSettings(): Promise<void> {
    const pkg = Constants.expoConfig?.android?.package ?? 'com.jvstuche.fiftythreexy';
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        { data: `package:${pkg}` },
      );
    } catch {
      // Some ROMs do not expose the per-app screen; fall back to the global list.
      await IntentLauncher.startActivityAsync(
        'android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION',
      );
    }
  }
  ```

- [ ] **Step 5: Implement `src/components/storage-access-sheet.tsx`**

  This is app UI, not player chrome, so it uses `useTheme()`. Modelled on the existing `tracks-sheet.tsx` modal shape.

  ```tsx
  import { Modal, Pressable, StyleSheet, View } from 'react-native';
  import { MaterialIcons } from '@expo/vector-icons';

  import { AppText } from '@/components/app-text';
  import { PressableScale } from '@/components/pressable-scale';
  import { useTheme } from '@/theme/theme-provider';

  export function StorageAccessSheet({
    onGrant,
    onClose,
  }: {
    onGrant: () => void;
    onClose: () => void;
  }) {
    const { colors, spacing, radius } = useTheme();

    return (
      <Modal transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: colors.surface ?? '#1e1e1e',
                borderRadius: radius.xl,
                padding: spacing.lg,
                marginHorizontal: spacing.lg,
                gap: spacing.md,
              },
            ]}>
            <MaterialIcons name="folder-open" size={28} color={colors.primary ?? '#90caf9'} />
            <AppText variant="titleMedium" style={{ color: colors.onSurface }}>
              Allow access to subtitle files
            </AppText>
            <AppText variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              Android treats subtitle files as non-media files, so 53XY needs All files access to
              read the .srt sitting next to your video. It is used only to read subtitle files.
            </AppText>
            <View style={[styles.actions, { gap: spacing.sm }]}>
              <PressableScale onPress={onClose} style={[styles.action, { paddingHorizontal: spacing.md }]}>
                <AppText variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
                  Not now
                </AppText>
              </PressableScale>
              <PressableScale
                onPress={onGrant}
                style={[
                  styles.action,
                  {
                    paddingHorizontal: spacing.lg,
                    borderRadius: radius.pill,
                    backgroundColor: colors.primary ?? '#90caf9',
                  },
                ]}>
                <AppText variant="labelLarge" style={{ color: colors.onPrimary ?? '#000' }}>
                  Open settings
                </AppText>
              </PressableScale>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    );
  }

  const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center' },
    sheet: { alignItems: 'flex-start' },
    actions: { flexDirection: 'row', alignSelf: 'flex-end', alignItems: 'center' },
    action: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  });
  ```

  If `AppText` does not expose the variant names used here, check `src/theme/typography.ts` and use whatever the ramp actually defines.

- [ ] **Step 6: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 7: Rebuild the dev client and confirm the toggle appears**

  Run: `npm run android`

  Then on the device: open Android Settings → Apps → 53XY (Dev) → the app should now offer an **All files access** entry. Grant it. This is the build every later task is verified against.

- [ ] **Step 8: Commit**

  ```bash
  git add app.config.ts package.json bun.lock src/subtitles/storage-access.ts src/components/storage-access-sheet.tsx
  git commit -m "$(cat <<'EOF'
  feat(subtitles): all-files access probe, rationale sheet, settings intent

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Subtitle loading and the `useSubtitles` hook

The one stateful piece. It owns: the directory walk, loading, the ticker, persistence, and permission state.

**Files:**
- Create: `src/subtitles/load-subtitle.ts`
- Create: `src/subtitles/use-subtitles.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8, `VideoPlayer` from `expo-video`, `useSQLiteContext` from `expo-sqlite`.
- Produces: `loadSubtitle(uri, name): Promise<LoadedSubtitle>`, `SubtitleTooLargeError`, `useSubtitles(opts): UseSubtitles` (shape below — Tasks 10–12 depend on these exact names).

- [ ] **Step 1: Implement `src/subtitles/load-subtitle.ts`**

  ```ts
  import { File } from 'expo-file-system';

  import type { LoadedSubtitle } from './types';
  import { decodeSubtitleBytes } from './decode-text';
  import { parseSubtitle, MAX_SUBTITLE_BYTES } from './parse-subtitle';

  export class SubtitleTooLargeError extends Error {
    constructor() {
      super('Subtitle file is too large');
      this.name = 'SubtitleTooLargeError';
    }
  }

  /**
   * Read, decode and parse a subtitle file.
   *
   * NOTE: confirm whether File.bytes() is sync or async in SDK 56 and drop the
   * await if it is synchronous — the v56 docs are authoritative.
   */
  export async function loadSubtitle(uri: string, name: string): Promise<LoadedSubtitle> {
    const file = new File(uri);
    const bytes = await file.bytes();
    if (bytes.length > MAX_SUBTITLE_BYTES) throw new SubtitleTooLargeError();
    const cues = parseSubtitle(name, decodeSubtitleBytes(bytes));
    return { uri, name, cues };
  }
  ```

- [ ] **Step 2: Implement `src/subtitles/use-subtitles.ts`**

  ```ts
  import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
  import { AppState, NativeModules, Platform } from 'react-native';
  import { Directory, File } from 'expo-file-system';
  import { useSQLiteContext } from 'expo-sqlite';
  import type { VideoPlayer } from 'expo-video';

  import { getSubtitlePrefs, setSubtitlePrefs } from '@/db/progress-repo';
  import { deriveFolder } from '@/media/derive-folder';

  import type { Cue, SubtitleCandidate } from './types';
  import { activeCues, cueTextOf } from './active-cue';
  import { findSubtitleCandidates, pickAutoLoad, SUBS_FOLDER_NAMES } from './find-sibling';
  import type { DirectoryEntry, SubsFolder } from './find-sibling';
  import { loadSubtitle, SubtitleTooLargeError } from './load-subtitle';
  import { subtitleFormatOf } from './parse-subtitle';
  import { canReadFolder, openAllFilesAccessSettings } from './storage-access';

  /** How often the cue clock ticks. 1s (the player's timeUpdate interval) would
   *  land lines up to a second late; 150ms is imperceptible and cheap. */
  const TICK_MS = 150;

  export interface UseSubtitles {
    /** Text to display right now; '' when nothing is active. */
    activeText: string;
    candidates: SubtitleCandidate[];
    active: { uri: string; name: string } | null;
    delayMs: number;
    /** True when auto-detect could not read the folder. */
    needsPermission: boolean;
    /** Transient message for the player's toast. */
    error: string | null;
    setDelayMs: (ms: number) => void;
    selectCandidate: (candidate: SubtitleCandidate) => Promise<void>;
    clearSubtitle: () => void;
    pickFromFile: () => Promise<void>;
    requestAccess: () => Promise<void>;
  }

  function joinUri(folderUri: string, relativePath: string): string {
    const base = folderUri.endsWith('/') ? folderUri.slice(0, -1) : folderUri;
    return `${base}/${relativePath.split('/').map(encodeURIComponent).join('/')}`;
  }

  function deviceLanguage(): string {
    // Expo's localization module is not installed; the platform locale is
    // enough for a two-letter comparison, and 'en' is a safe default.
    const locale =
      Platform.OS === 'android'
        ? (NativeModules.I18nManager?.localeIdentifier as string | undefined)
        : undefined;
    return (locale ?? 'en').replace('_', '-').split('-')[0].toLowerCase();
  }

  export function useSubtitles({
    player,
    videoId,
    videoUri,
    embeddedActive,
  }: {
    player: VideoPlayer;
    videoId: string | undefined;
    videoUri: string | undefined;
    /** True when an embedded track is currently displayed — external subtitles
     *  stand down so two sets never stack on screen. */
    embeddedActive: boolean;
  }): UseSubtitles {
    const db = useSQLiteContext();

    const [cues, setCues] = useState<Cue[] | null>(null);
    const [active, setActive] = useState<{ uri: string; name: string } | null>(null);
    const [candidates, setCandidates] = useState<SubtitleCandidate[]>([]);
    const [delayMs, setDelayMsState] = useState(0);
    const [needsPermission, setNeedsPermission] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeText, setActiveText] = useState('');

    // Read by the ticker without re-creating the interval on every change.
    const delayRef = useRef(0);
    delayRef.current = delayMs;
    const cuesRef = useRef<Cue[] | null>(null);
    cuesRef.current = cues;
    const shownRef = useRef('');

    const folderUri = useMemo(() => {
      if (!videoUri) return null;
      const slash = videoUri.lastIndexOf('/');
      return slash > 0 ? videoUri.slice(0, slash) : null;
    }, [videoUri]);

    const videoName = useMemo(() => {
      if (!videoUri) return '';
      const raw = videoUri.slice(videoUri.lastIndexOf('/') + 1);
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }, [videoUri]);

    // ── Scan the folder for candidates ────────────────────────────────────
    const scan = useCallback((): SubtitleCandidate[] => {
      if (!folderUri) return [];
      if (!canReadFolder(folderUri)) {
        setNeedsPermission(true);
        return [];
      }
      setNeedsPermission(false);
      try {
        const listing = new Directory(folderUri).list();
        const entries: DirectoryEntry[] = listing.map((item) => ({
          name: item.name,
          isDirectory: item instanceof Directory,
        }));

        let subsFolder: SubsFolder | null = null;
        const subsDir = listing.find(
          (item) => item instanceof Directory && SUBS_FOLDER_NAMES.includes(item.name.toLowerCase()),
        );
        if (subsDir instanceof Directory) {
          subsFolder = {
            name: subsDir.name,
            entries: subsDir.list().map((item) => ({
              name: item.name,
              isDirectory: item instanceof Directory,
            })),
          };
        }
        return findSubtitleCandidates(videoName, entries, subsFolder);
      } catch {
        return [];
      }
    }, [folderUri, videoName]);

    const applyLoad = useCallback(
      async (uri: string, name: string, persist: boolean) => {
        try {
          const loaded = await loadSubtitle(uri, name);
          if (loaded.cues.length === 0) {
            setError(`No subtitles found in ${name}`);
            return;
          }
          setCues(loaded.cues);
          setActive({ uri: loaded.uri, name: loaded.name });
          // Mutually exclusive with embedded tracks.
          player.subtitleTrack = null;
          if (persist && videoId) {
            await setSubtitlePrefs(db, videoId, uri, delayRef.current, Date.now());
          }
        } catch (e) {
          setError(
            e instanceof SubtitleTooLargeError ? 'Subtitle file is too large' : `Could not read ${name}`,
          );
        }
      },
      [db, player, videoId],
    );

    // ── On video change: reset, restore prefs, then auto-detect ───────────
    useEffect(() => {
      let cancelled = false;
      setCues(null);
      setActive(null);
      setActiveText('');
      shownRef.current = '';
      setCandidates([]);
      setDelayMsState(0);
      delayRef.current = 0;
      if (!videoId || !videoUri) return;

      (async () => {
        const prefs = await getSubtitlePrefs(db, videoId);
        if (cancelled) return;
        setDelayMsState(prefs.delayMs);
        delayRef.current = prefs.delayMs;

        const found = scan();
        if (cancelled) return;
        setCandidates(found);

        // A remembered file wins, as long as it still exists.
        if (prefs.uri) {
          const name = decodeURIComponent(prefs.uri.slice(prefs.uri.lastIndexOf('/') + 1));
          try {
            if (new File(prefs.uri).exists) {
              await applyLoad(prefs.uri, name, false);
              return;
            }
          } catch {
            // fall through to auto-detect
          }
        }

        // Do not auto-load over an embedded track that is already showing.
        if (embeddedActive || !folderUri) return;
        const pick = pickAutoLoad(found, deviceLanguage());
        if (pick) await applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false);
      })();

      return () => {
        cancelled = true;
      };
      // embeddedActive is deliberately excluded: this effect is the per-video
      // reset, and re-running it when the user toggles an embedded track would
      // wipe their external selection.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, videoId, videoUri, folderUri, scan, applyLoad]);

    // ── The cue clock ─────────────────────────────────────────────────────
    useEffect(() => {
      if (!cues || cues.length === 0) {
        setActiveText('');
        shownRef.current = '';
        return;
      }
      const id = setInterval(() => {
        // Runs while paused too, so seeking or scrubbing with the video
        // stopped still updates the visible line.
        const timeMs = player.currentTime * 1000;
        const text = cueTextOf(activeCues(cuesRef.current ?? [], timeMs, delayRef.current));
        // Only touch state when the visible text actually changes, so the
        // steady-state cost of the ticker is a comparison.
        if (text !== shownRef.current) {
          shownRef.current = text;
          setActiveText(text);
        }
      }, TICK_MS);
      return () => clearInterval(id);
    }, [cues, player]);

    // ── Re-probe when returning from the system settings screen ───────────
    useEffect(() => {
      if (!needsPermission) return;
      const sub = AppState.addEventListener('change', (state) => {
        if (state !== 'active' || !folderUri) return;
        if (!canReadFolder(folderUri)) return;
        setNeedsPermission(false);
        const found = scan();
        setCandidates(found);
        if (!active && !embeddedActive) {
          const pick = pickAutoLoad(found, deviceLanguage());
          if (pick) void applyLoad(joinUri(folderUri, pick.relativePath), pick.name, false);
        }
      });
      return () => sub.remove();
    }, [needsPermission, folderUri, scan, active, embeddedActive, applyLoad]);

    // ── Actions ───────────────────────────────────────────────────────────
    const setDelayMs = useCallback(
      (ms: number) => {
        setDelayMsState(ms);
        delayRef.current = ms;
        // Force an immediate re-evaluation so dragging feels live rather than
        // waiting up to a tick.
        const text = cueTextOf(activeCues(cuesRef.current ?? [], player.currentTime * 1000, ms));
        if (text !== shownRef.current) {
          shownRef.current = text;
          setActiveText(text);
        }
        if (videoId) void setSubtitlePrefs(db, videoId, active?.uri ?? null, ms, Date.now());
      },
      [db, player, videoId, active],
    );

    const selectCandidate = useCallback(
      async (candidate: SubtitleCandidate) => {
        if (!folderUri) return;
        await applyLoad(joinUri(folderUri, candidate.relativePath), candidate.name, true);
      },
      [folderUri, applyLoad],
    );

    const clearSubtitle = useCallback(() => {
      setCues(null);
      setActive(null);
      setActiveText('');
      shownRef.current = '';
      if (videoId) void setSubtitlePrefs(db, videoId, null, delayRef.current, Date.now());
    }, [db, videoId]);

    const pickFromFile = useCallback(async () => {
      try {
        // SAF picker — needs no permission at all, so this keeps working even
        // when all-files access was declined.
        const result = await File.pickFileAsync({ mimeTypes: ['*/*'] });
        const file = Array.isArray(result) ? result[0] : result;
        if (!file || !('uri' in file)) return;
        const name = file.name ?? 'subtitle.srt';
        if (!subtitleFormatOf(name)) {
          setError('Not a supported subtitle file');
          return;
        }
        await applyLoad(file.uri, name, true);
      } catch {
        // User cancelled the picker.
      }
    }, [applyLoad]);

    const requestAccess = useCallback(async () => {
      await openAllFilesAccessSettings();
    }, []);

    // Clear a toast message once it has been shown.
    useEffect(() => {
      if (!error) return;
      const id = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(id);
    }, [error]);

    return {
      activeText,
      candidates,
      active,
      delayMs,
      needsPermission,
      error,
      setDelayMs,
      selectCandidate,
      clearSubtitle,
      pickFromFile,
      requestAccess,
    };
  }
  ```

- [ ] **Step 3: Reconcile with the v56 docs**

  `File.pickFileAsync`'s result shape and `File.exists` are the two most likely mismatches. Fix the code to match the docs; do not fight the types.

- [ ] **Step 4: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 5: Commit**

  ```bash
  git add src/subtitles
  git commit -m "$(cat <<'EOF'
  feat(subtitles): loader and useSubtitles hook with a 150ms cue clock

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 10: Subtitle overlay + player wiring

End of this task, auto-detected subtitles are visible on a real video. This is the milestone worth verifying carefully.

**Files:**
- Create: `src/components/player/subtitle-overlay.tsx`
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `useSubtitles` from Task 9, `activeSubtitle` state already in `player.tsx:174`.
- Produces: `<SubtitleOverlay text sizeKey lifted />`.

- [ ] **Step 1: Create `src/components/player/subtitle-overlay.tsx`**

  ```tsx
  import { StyleSheet, Text, View } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';

  export type SubtitleSize = 's' | 'm' | 'l' | 'xl';

  const FONT_SIZES: Record<SubtitleSize, number> = { s: 14, m: 17, l: 20, xl: 24 };

  /** Clearance for the bottom bar when the chrome is showing. */
  const LIFTED_OFFSET = 96;
  const RESTING_OFFSET = 24;

  /**
   * External-subtitle text, drawn over the video.
   *
   * Player chrome, so fixed colours rather than Material You (HANDOFF §4).
   * pointerEvents none throughout: this must never enter touch dispatch or it
   * would break the gesture arena underneath.
   *
   * Not visible in PiP or background playback — it is a React view, not part
   * of the video surface.
   */
  export function SubtitleOverlay({
    text,
    sizeKey,
    lifted,
  }: {
    text: string;
    sizeKey: SubtitleSize;
    /** True when the controls chrome is visible, so the text clears the bottom bar. */
    lifted: boolean;
  }) {
    const insets = useSafeAreaInsets();
    if (!text) return null;

    return (
      <View
        pointerEvents="none"
        style={[
          styles.container,
          { bottom: (lifted ? LIFTED_OFFSET : RESTING_OFFSET) + insets.bottom },
        ]}>
        <Text
          allowFontScaling={false}
          style={[styles.text, { fontSize: FONT_SIZES[sizeKey] }]}>
          {text}
        </Text>
      </View>
    );
  }

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: '5%',
    },
    text: {
      color: '#fff',
      textAlign: 'center',
      fontWeight: '600',
      // A heavy shadow rather than a background box: readable over bright
      // frames without a slab of black sitting on the picture.
      textShadowColor: 'rgba(0,0,0,0.9)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
  });
  ```

- [ ] **Step 2: Wire the hook into `src/app/player.tsx`**

  Add the imports beside the other player imports:

  ```ts
  import { useSubtitles } from '@/subtitles/use-subtitles';
  import { SubtitleOverlay } from '@/components/player/subtitle-overlay';
  ```

  Then, after the existing `activeSubtitle` state (around `player.tsx:174`), call the hook:

  ```ts
  const subtitles = useSubtitles({
    player,
    videoId,
    videoUri: uri,
    embeddedActive: activeSubtitle !== null,
  });
  ```

  Confirm the local variable names for the route params — the screen already destructures `videoId`, `uri` and `title`. Use whatever it actually calls them.

- [ ] **Step 3: Render the overlay**

  In the render tree, place it immediately **after** the video's `Animated.View` (which closes just before the `{locked ? ... }` ternary, around `player.tsx:963`) and **before** that ternary — so it draws above the video, below all chrome, and stays visible when the screen is locked:

  ```tsx
  <SubtitleOverlay
    text={subtitles.activeText}
    sizeKey="m"
    lifted={controlsVisible && !locked}
  />
  ```

  `sizeKey` is hard-coded to `'m'` here and becomes a real setting in Task 13.

- [ ] **Step 4: Surface loader errors through the existing toast**

  `player.tsx` already has a `toast` state and `<PlayerToast />`. Add an effect near the other effects:

  ```ts
  useEffect(() => {
    if (subtitles.error) setToast(subtitles.error);
  }, [subtitles.error]);
  ```

- [ ] **Step 5: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 6: Verify on device**

  Put `Movie.srt` next to a `Movie.mkv` on the phone (`adb push`), then open that video in the app.

  Expected: subtitles appear in time with the dialogue, sit above the bottom bar while the controls show, drop lower when the chrome hides, and stay visible when the screen is locked. Take a screenshot for the record.

- [ ] **Step 7: Commit**

  ```bash
  git add src/components/player/subtitle-overlay.tsx src/app/player.tsx
  git commit -m "$(cat <<'EOF'
  feat(player): render auto-detected external subtitles

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 11: External section in the tracks sheet

**Files:**
- Modify: `src/components/player/tracks-sheet.tsx`
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `UseSubtitles` from Task 9.
- Produces: `TracksSheetProps` extended with `subtitles: UseSubtitles` and `onAdjustDelay: () => void`.

- [ ] **Step 1: Extend `TracksSheetProps`**

  ```ts
  import type { UseSubtitles } from '@/subtitles/use-subtitles';

  interface TracksSheetProps {
    player: VideoPlayer;
    subtitleTracks: SubtitleTrack[];
    audioTracks: AudioTrack[];
    activeSubtitle: SubtitleTrack | null;
    activeAudio: AudioTrack | null;
    subtitles: UseSubtitles;
    onAdjustDelay: () => void;
    onClose: () => void;
  }
  ```

- [ ] **Step 2: Delete the "no tracks" early return**

  The `if (!hasSubtitles && !hasAudio)` branch that renders "No embedded tracks available" is now wrong — the sheet always has external options to offer. Remove that whole block and let the normal sheet render.

- [ ] **Step 3: Render the External section above the embedded ones**

  Inside the `ScrollView`, before the `{hasSubtitles && ...}` block:

  ```tsx
  <Text
    style={[
      styles.sectionTitle,
      { color: colors.onSurfaceVariant ?? '#aaa', marginHorizontal: spacing.lg },
    ]}>
    External subtitles
  </Text>

  {subtitles.candidates.map((candidate) => (
    <TrackRow
      key={candidate.relativePath}
      label={candidate.name}
      isActive={subtitles.active?.name === candidate.name}
      onPress={() => {
        void subtitles.selectCandidate(candidate);
        onClose();
      }}
      colors={colors}
      spacing={spacing}
    />
  ))}

  {subtitles.needsPermission && (
    <TrackRow
      label="Allow access to subtitle files…"
      isActive={false}
      onPress={() => {
        void subtitles.requestAccess();
        onClose();
      }}
      colors={colors}
      spacing={spacing}
    />
  )}

  <TrackRow
    label="Load from file…"
    isActive={false}
    onPress={() => {
      void subtitles.pickFromFile();
      onClose();
    }}
    colors={colors}
    spacing={spacing}
  />

  {subtitles.active && (
    <TrackRow
      label="Adjust delay…"
      isActive={false}
      onPress={() => {
        onAdjustDelay();
        onClose();
      }}
      colors={colors}
      spacing={spacing}
    />
  )}

  {subtitles.active && (
    <TrackRow
      label="Off"
      isActive={false}
      onPress={() => {
        subtitles.clearSubtitle();
        onClose();
      }}
      colors={colors}
      spacing={spacing}
    />
  )}
  ```

- [ ] **Step 4: Make embedded selection clear the external subtitle**

  In `handleSelectSubtitle`, so the two sources stay mutually exclusive:

  ```ts
  function handleSelectSubtitle(track: SubtitleTrack | null) {
    if (track !== null) subtitles.clearSubtitle();
    player.subtitleTrack = track;
    onClose();
  }
  ```

- [ ] **Step 5: Pass the new props from `player.tsx`**

  Add `delaySheetVisible` state beside the other player state:

  ```ts
  const [delayBarVisible, setDelayBarVisible] = useState(false);
  ```

  and extend the `<TracksSheet ... />` usage:

  ```tsx
  subtitles={subtitles}
  onAdjustDelay={() => setDelayBarVisible(true)}
  ```

- [ ] **Step 6: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 7: Verify on device**

  Open the tracks sheet on a video with a sibling subtitle. Expected: the file is listed and checked; "Load from file…" opens the system picker and a picked `.srt` renders; picking an embedded track turns the external one off; "Off" clears subtitles.

- [ ] **Step 8: Commit**

  ```bash
  git add src/components/player/tracks-sheet.tsx src/app/player.tsx
  git commit -m "$(cat <<'EOF'
  feat(player): external subtitle section in the tracks sheet

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 12: Delay bar

Not a modal: you have to watch the subtitles move to sync them. Playback continues underneath and cues shift live as the slider is dragged.

**Files:**
- Create: `src/components/player/subtitle-delay-bar.tsx`
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `usePlayerGestureRelations` from `./player-gesture-relations`, `PlayerPressableScale`, `UseSubtitles.setDelayMs`.
- Produces: `<SubtitleDelayBar delayMs onChange onClose />`.

- [ ] **Step 1: Create `src/components/player/subtitle-delay-bar.tsx`**

  The slider is a raw `Gesture.Pan` that calls `.blocksExternalGesture(...)` — the same arena discipline as `PlayerPressableScale`. It sits over the middle of the screen where the brightness/volume pans are live, so without that call the two would fight.

  ```tsx
  import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
  import { StyleSheet, Text, View } from 'react-native';
  import { MaterialIcons } from '@expo/vector-icons';
  import { Gesture, GestureDetector } from 'react-native-gesture-handler';
  import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
  import { scheduleOnRN } from 'react-native-worklets';

  import { ON_ARTWORK } from '@/theme/resolve-theme';
  import { ChromeButton } from './chrome-button';
  import { usePlayerGestureRelations } from './player-gesture-relations';

  /** Range and granularity of the delay control. */
  export const DELAY_RANGE_MS = 20000;
  const STEP_MS = 50;
  /** Idle time before the bar fades away on its own. */
  const AUTO_HIDE_MS = 4000;

  function quantize(ms: number): number {
    const clamped = Math.max(-DELAY_RANGE_MS, Math.min(DELAY_RANGE_MS, ms));
    return Math.round(clamped / STEP_MS) * STEP_MS;
  }

  function formatDelay(ms: number): string {
    const sign = ms > 0 ? '+' : ms < 0 ? '−' : '';
    return `${sign}${(Math.abs(ms) / 1000).toFixed(2)}s`;
  }

  export function SubtitleDelayBar({
    delayMs,
    onChange,
    onClose,
  }: {
    delayMs: number;
    onChange: (ms: number) => void;
    onClose: () => void;
  }) {
    const relations = usePlayerGestureRelations();
    const barWidth = useSharedValue(0);
    const dragging = useSharedValue(false);
    const dragFraction = useSharedValue(0);

    // Mirror the resting delay into a shared value for the thumb's position.
    const restFraction = (delayMs + DELAY_RANGE_MS) / (2 * DELAY_RANGE_MS);
    const restFractionSV = useSharedValue(restFraction);
    useEffect(() => {
      restFractionSV.value = restFraction;
    }, [restFraction, restFractionSV]);

    // ── Auto-hide ─────────────────────────────────────────────────────────
    const [interactions, setInteractions] = useState(0);
    const bump = useCallback(() => setInteractions((n) => n + 1), []);
    const draggingJs = useRef(false);
    useEffect(() => {
      const id = setTimeout(() => {
        if (!draggingJs.current) onClose();
      }, AUTO_HIDE_MS);
      return () => clearTimeout(id);
    }, [interactions, onClose]);

    const commit = useCallback(
      (fraction: number) => {
        onChange(quantize(fraction * 2 * DELAY_RANGE_MS - DELAY_RANGE_MS));
        bump();
      },
      [onChange, bump],
    );

    const nudge = useCallback(
      (deltaMs: number) => {
        onChange(quantize(delayMs + deltaMs));
        bump();
      },
      [delayMs, onChange, bump],
    );

    const setDraggingJs = useCallback((value: boolean) => {
      draggingJs.current = value;
    }, []);

    const pan = useMemo(() => {
      const g = Gesture.Pan()
        .minDistance(0)
        .onBegin((e) => {
          'worklet';
          dragging.value = true;
          scheduleOnRN(setDraggingJs, true);
          if (barWidth.value > 0) {
            const f = Math.min(1, Math.max(0, e.x / barWidth.value));
            dragFraction.value = f;
            scheduleOnRN(commit, f);
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (barWidth.value > 0) {
            const f = Math.min(1, Math.max(0, e.x / barWidth.value));
            dragFraction.value = f;
            // Live: cues shift under the finger rather than on release.
            scheduleOnRN(commit, f);
          }
        })
        .onFinalize(() => {
          'worklet';
          restFractionSV.value = dragFraction.value;
          dragging.value = false;
          scheduleOnRN(setDraggingJs, false);
        });
      // Same arena discipline as PlayerPressableScale: without this the
      // screen's brightness/volume pan fights the slider.
      if (relations) g.blocksExternalGesture(...relations);
      return g;
    }, [relations, commit, setDraggingJs, barWidth, dragFraction, dragging, restFractionSV]);

    const filledStyle = useAnimatedStyle(() => {
      const f = dragging.value ? dragFraction.value : restFractionSV.value;
      return { width: `${f * 100}%` as `${number}%` };
    });
    const thumbStyle = useAnimatedStyle(() => {
      const f = dragging.value ? dragFraction.value : restFractionSV.value;
      return { left: `${f * 100}%` as `${number}%` };
    });

    return (
      <View style={styles.wrapper} pointerEvents="box-none">
        <View style={[styles.bar, { backgroundColor: ON_ARTWORK.chip }]}>
          <View style={styles.row}>
            <ChromeButton size={36} onPress={() => nudge(-500)}>
              <Text style={styles.nudgeLabel}>−0.5</Text>
            </ChromeButton>
            <ChromeButton size={36} onPress={() => nudge(-100)}>
              <Text style={styles.nudgeLabel}>−0.1</Text>
            </ChromeButton>
            <Text style={styles.value}>{formatDelay(delayMs)}</Text>
            <ChromeButton size={36} onPress={() => nudge(100)}>
              <Text style={styles.nudgeLabel}>+0.1</Text>
            </ChromeButton>
            <ChromeButton size={36} onPress={() => nudge(500)}>
              <Text style={styles.nudgeLabel}>+0.5</Text>
            </ChromeButton>
            <ChromeButton size={36} onPress={() => { onChange(0); bump(); }}>
              <MaterialIcons name="restart-alt" size={18} color="#fff" />
            </ChromeButton>
          </View>

          <GestureDetector gesture={pan}>
            <View
              style={styles.hitArea}
              onLayout={(e) => {
                barWidth.value = e.nativeEvent.layout.width;
              }}>
              <View style={styles.track}>
                <Animated.View style={[styles.filled, filledStyle]} />
              </View>
              <Animated.View style={[styles.thumb, thumbStyle]} />
            </View>
          </GestureDetector>

          <Text style={styles.hint}>Positive delay shows subtitles later</Text>
        </View>
      </View>
    );
  }

  const TRACK_HEIGHT = 4;
  const THUMB_SIZE = 16;

  const styles = StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 24,
    },
    bar: { width: '100%', maxWidth: 520, borderRadius: 20, padding: 12, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nudgeLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
    value: { color: '#fff', fontSize: 15, fontWeight: '700', minWidth: 64, textAlign: 'center' },
    hitArea: { height: 28, justifyContent: 'center' },
    track: {
      height: TRACK_HEIGHT,
      borderRadius: TRACK_HEIGHT / 2,
      overflow: 'hidden',
      marginHorizontal: THUMB_SIZE / 2,
      backgroundColor: 'rgba(255,255,255,0.3)',
    },
    filled: { height: TRACK_HEIGHT, borderRadius: TRACK_HEIGHT / 2, backgroundColor: '#9C8CFF' },
    thumb: {
      position: 'absolute',
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      borderRadius: THUMB_SIZE / 2,
      marginLeft: -(THUMB_SIZE / 2),
      top: '50%',
      marginTop: -(THUMB_SIZE / 2),
      backgroundColor: '#9C8CFF',
    },
    hint: { color: 'rgba(255,255,255,0.6)', fontSize: 11, textAlign: 'center' },
  });
  ```

- [ ] **Step 2: Render it in `player.tsx`**

  Place it **inside** `<PlayerGestures>` but **outside** `<ControlsOverlay>` — exactly where `AutoplayCard` sits, and for the same two reasons: inside the gestures so its controls get the arena relation, outside the chrome so it stays put while the chrome auto-hides.

  ```tsx
  {delayBarVisible && subtitles.active && (
    <SubtitleDelayBar
      delayMs={subtitles.delayMs}
      onChange={subtitles.setDelayMs}
      onClose={() => setDelayBarVisible(false)}
    />
  )}
  ```

  Import it beside the other player components.

- [ ] **Step 3: Typecheck**

  Run: `npx tsc --noEmit`
  Expected: clean.

- [ ] **Step 4: Verify on device — including the gesture regression sweep**

  Open a video with subtitles → tracks sheet → "Adjust delay…".

  Expected: the bar appears with playback continuing; dragging the slider shifts the subtitles live; nudge buttons step by 0.1/0.5 s; reset returns to 0.00 s; the bar disappears after ~4 s of no interaction and not while dragging.

  Then, with the bar open, sweep the player gestures and confirm none broke: double-tap side seek, brightness swipe (left), volume swipe (right), horizontal drag-scrub, long-press 2× boost, lock overlay. This is the regression class that has bitten this player twice before.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/player/subtitle-delay-bar.tsx src/app/player.tsx
  git commit -m "$(cat <<'EOF'
  feat(player): live subtitle delay bar with nudge buttons and reset

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 13: Subtitle text size setting

**Files:**
- Create: `src/player/use-subtitle-size.ts`
- Modify: `src/app/settings/player.tsx`
- Modify: `src/app/player.tsx`

**Interfaces:**
- Consumes: `getSetting`/`setSetting` from `@/db/settings-repo`, `SubtitleSize` from the overlay.
- Produces: `useSubtitleSize(): { subtitleSize: SubtitleSize; setSubtitleSize: (v: SubtitleSize) => Promise<void> }`.

- [ ] **Step 1: Create `src/player/use-subtitle-size.ts`**

  Mirrors `use-autoplay-next.ts` exactly, including the mounted guard.

  ```ts
  import { useState, useEffect } from 'react';
  import { useSQLiteContext } from 'expo-sqlite';

  import { getSetting, setSetting } from '@/db/settings-repo';
  import type { SubtitleSize } from '@/components/player/subtitle-overlay';

  const VALID: SubtitleSize[] = ['s', 'm', 'l', 'xl'];

  /** Global subtitle text size. Defaults to medium. */
  export function useSubtitleSize() {
    const db = useSQLiteContext();
    const [subtitleSize, setSubtitleSizeState] = useState<SubtitleSize>('m');

    useEffect(() => {
      let mounted = true;
      getSetting(db, 'subtitle_text_size').then((val) => {
        if (mounted && val !== null && VALID.includes(val as SubtitleSize)) {
          setSubtitleSizeState(val as SubtitleSize);
        }
      });
      return () => {
        mounted = false;
      };
    }, [db]);

    const setSubtitleSize = async (v: SubtitleSize) => {
      setSubtitleSizeState(v);
      await setSetting(db, 'subtitle_text_size', v);
    };

    return { subtitleSize, setSubtitleSize };
  }
  ```

- [ ] **Step 2: Add the picker to `src/app/settings/player.tsx`**

  `SegmentedTabs` is hard-coded to the Videos/Folders pair, so this screen gets its own small row rather than a speculative generic control.

  Add the imports:

  ```tsx
  import { Pressable } from 'react-native';
  import { AppText } from '@/components/app-text';
  import { useSubtitleSize } from '@/player/use-subtitle-size';
  import type { SubtitleSize } from '@/components/player/subtitle-overlay';
  ```

  Call the hook alongside the others, then render below the existing `SettingsGroup`:

  ```tsx
  <SettingsGroup insetDividers={false}>
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      <AppText variant="bodyLarge" style={{ color: colors.onSurface }}>
        Subtitle text size
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {(['s', 'm', 'l', 'xl'] as SubtitleSize[]).map((key) => {
          const active = key === subtitleSize;
          return (
            <Pressable
              key={key}
              onPress={() => void setSubtitleSize(key)}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.pill,
                backgroundColor: active
                  ? (colors.primary ?? '#90caf9')
                  : (colors.surfaceContainerHigh ?? colors.surfaceVariant ?? '#222'),
              }}>
              <AppText
                variant="labelLarge"
                style={{ color: active ? (colors.onPrimary ?? '#000') : (colors.onSurfaceVariant ?? '#aaa') }}>
                {key.toUpperCase()}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  </SettingsGroup>
  ```

  Pull `colors` and `radius` out of `useTheme()` — the screen currently destructures only `spacing`.

- [ ] **Step 3: Use the setting in `player.tsx`**

  Replace the hard-coded `sizeKey="m"` from Task 10:

  ```ts
  const { subtitleSize } = useSubtitleSize();
  ```

  ```tsx
  <SubtitleOverlay
    text={subtitles.activeText}
    sizeKey={subtitleSize}
    lifted={controlsVisible && !locked}
  />
  ```

- [ ] **Step 4: Typecheck and run the full suite**

  Run: `npx tsc --noEmit && npm test`
  Expected: clean, all PASS.

- [ ] **Step 5: Verify on device**

  Settings → Player → change the size, then open a video with subtitles. Expected: the new size applies, and it survives an app restart.

- [ ] **Step 6: Commit**

  ```bash
  git add src/player/use-subtitle-size.ts src/app/settings/player.tsx src/app/player.tsx
  git commit -m "$(cat <<'EOF'
  feat(settings): global subtitle text size

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 14: Full device verification + docs

**Files:**
- Modify: `docs/HANDOFF.md` (§2 status table + §7 changelog)

- [ ] **Step 1: Run the full check**

  Run: `npm test && npx tsc --noEmit`
  Expected: all PASS, clean.

- [ ] **Step 2: Work the device checklist**

  On the rebuilt dev client, with real files pushed to the phone. Record the result of each — do not mark the task done on an untested row.

  1. `Movie.mkv` + `Movie.srt` → auto-loads on open.
  2. `Movie.mkv` + `Movie.en.srt` + `Movie.fr.srt` → auto-loads one, both listed in the sheet, switching works.
  3. `Movie.mkv` + `Movie.forced.srt` + `Movie.srt` → the full track auto-loads, not the forced one.
  4. Single-video folder with `Subs/2_English.srt` → auto-loads.
  5. Season folder with two episodes and an unmatched `Subs/` file → nothing auto-loads (correct: it would be a guess).
  6. A `.ass` file → dialogue renders as plain text.
  7. A CP1252-encoded `.srt` with accented characters → accents render correctly, no replacement junk.
  8. Delay: drag, nudge, reset — subtitles shift live.
  9. Reopen the video → the same subtitle and the same delay come back.
  10. Turn off All files access in system settings, reopen → the sheet offers to grant it, and "Load from file…" still works without it.
  11. Gesture regression sweep with the delay bar open (double-tap seek, brightness, volume, drag-scrub, long-press boost, lock).
  12. PiP / background playback → no crash (subtitles are expected to be absent).

- [ ] **Step 3: Update `docs/HANDOFF.md`**

  Add a row to the §2 status table:

  ```markdown
  | External subtitles | `.srt`/`.vtt`/`.ass` loaded from storage (auto-detected sibling, ranked candidates, manual picker), JS-rendered overlay on a 150ms cue clock, live delay bar, global text size; all-files access via probe + rationale sheet; migration v10 | ✅ merged, device-verified |
  ```

  And one bullet in §7 Changelog, matching the surrounding style. Note in it that online subtitle download remains deferred to its own spec.

- [ ] **Step 4: Commit**

  ```bash
  git add docs/HANDOFF.md
  git commit -m "$(cat <<'EOF'
  docs: log external subtitle loading, delay bar, and text size

  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Self-review notes

**Spec coverage:** §1 render-ourselves → Tasks 9–10. §2 module layout → Tasks 2–9 (the plan splits the spec's parser module into `timestamp`/`strip-tags`/`parse-cue-blocks` so SRT and VTT share one scanner; `load-subtitle` and `use-subtitles` are separate files as specced). §3 parsing/encoding/size guard → Tasks 2–5. §4 ticker/lookup/overlay → Tasks 7, 9, 10. §5 storage access → Task 8. §6 auto-detect + mutual exclusion → Tasks 6, 9, 11. §7 UI → Tasks 10–13. §8 persistence → Task 1. §9 tests → every pure task plus Task 14. §10 risks → the CP1252 hand-rolled decoder (Task 2), the isolated probe (Task 8), the `blocksExternalGesture` call and regression sweep (Task 12), the ticker's change-only state updates (Task 9), the 10 MB guard (Tasks 5, 9). §11 download → out of scope, noted in Task 14's changelog entry.

**Deviation from the spec, deliberate:** the spec said the delay slider follows `seekbar.tsx`'s pattern; the plan follows it *and* adds `.blocksExternalGesture(...)`, which the seekbar does not call. The seekbar lives inside the chrome overlay and gets away with it; the delay bar sits over the live brightness/volume pan region and would not.

**Open item for the implementer:** the exact `expo-file-system` v56 API shapes (`File.bytes()` sync vs async, `File.pickFileAsync` result shape, `File.exists`) are asserted from the installed type definitions, not from the docs. Task 8 Step 1 and Task 9 Step 3 require checking https://docs.expo.dev/versions/v56.0.0/ and adjusting. The docs win.
