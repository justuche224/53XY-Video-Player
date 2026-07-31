import {
  candidatePositions,
  decideThumbAction,
  needsThumbnail,
  thumbFileName,
  THUMB_MAX_ATTEMPTS,
  THUMB_VERSION,
} from '../thumb-policy';

describe('candidatePositions', () => {
  it('walks 25% → 45% → 12% → 65% of a feature-length video', () => {
    expect(candidatePositions(3_600_000)).toEqual([900_000, 1_620_000, 432_000, 2_340_000]);
  });

  it('falls back to a fixed position when the duration is unknown', () => {
    expect(candidatePositions(null)).toEqual([3000]);
    expect(candidatePositions(0)).toEqual([3000]);
  });

  it('collapses to a single mid-point for very short clips', () => {
    expect(candidatePositions(1500)).toEqual([750]);
  });

  it('drops candidates that would land on the same keyframe', () => {
    // 4s clip: 1000 / 1800 / 480→1000 / 2600 — only 1000 and 2600 survive the 1s spacing rule.
    expect(candidatePositions(4000)).toEqual([1000, 2600]);
  });

  it('keeps every candidate inside the video, away from both edges', () => {
    for (const duration of [2500, 9000, 61_000, 7_200_000]) {
      for (const p of candidatePositions(duration)) {
        expect(p).toBeGreaterThan(0);
        expect(p).toBeLessThan(duration);
      }
    }
  });
});

describe('thumbFileName', () => {
  it('keys a file by video id and width', () => {
    expect(thumbFileName('1234', 640)).toBe('1234@640.jpg');
  });

  it('replaces characters that are unsafe in a filename', () => {
    expect(thumbFileName('a/b:c', 1280)).toBe('a_b_c@1280.jpg');
  });
});

describe('needsThumbnail', () => {
  const fresh = { uri: 'file:///a.jpg', version: THUMB_VERSION, attempts: 0, timeMs: 100 };

  it('is true when the video has never been processed', () => {
    expect(needsThumbnail(undefined, false)).toBe(true);
  });

  it('is false for a current thumbnail whose file is present', () => {
    expect(needsThumbnail(fresh, true)).toBe(false);
  });

  it('is true when the file has vanished from disk', () => {
    expect(needsThumbnail(fresh, false)).toBe(true);
  });

  it('is true when the thumbnail predates the current algorithm', () => {
    expect(needsThumbnail({ ...fresh, version: THUMB_VERSION - 1 }, true)).toBe(true);
  });

  it('gives up after the attempt limit at the current version', () => {
    const exhausted = { uri: null, version: THUMB_VERSION, attempts: THUMB_MAX_ATTEMPTS, timeMs: null };
    expect(needsThumbnail(exhausted, false)).toBe(false);
  });

  it('retries an exhausted video once the algorithm version moves on', () => {
    const oldExhausted = {
      uri: null,
      version: THUMB_VERSION - 1,
      attempts: THUMB_MAX_ATTEMPTS,
      timeMs: null,
    };
    expect(needsThumbnail(oldExhausted, false)).toBe(true);
  });
});

describe('decideThumbAction', () => {
  // Four state categories from the review: missing (never processed), fresh
  // (current version, succeeded), stale-version (predates THUMB_VERSION), and
  // attempts-exhausted (current version, gave up). Crossed with file
  // present/absent and card/non-card — 16 combinations, all asserted.
  const missing = undefined;
  const fresh = { uri: 'file:///card.jpg', version: THUMB_VERSION, attempts: 0, timeMs: 500 };
  const staleVersion = {
    uri: 'file:///old-card.jpg',
    version: THUMB_VERSION - 1,
    attempts: 0,
    timeMs: 500,
  };
  const attemptsExhausted = {
    uri: null,
    version: THUMB_VERSION,
    attempts: THUMB_MAX_ATTEMPTS,
    timeMs: null,
  };

  describe('card width', () => {
    it('serves a fresh thumbnail whose file is present', () => {
      expect(decideThumbAction(fresh, true, true)).toBe('serve');
    });

    it('serves the last-known file once attempts are exhausted, if one exists', () => {
      expect(decideThumbAction(attemptsExhausted, true, true)).toBe('serve');
    });

    it('regenerates when never processed, regardless of a file being present', () => {
      expect(decideThumbAction(missing, true, true)).toBe('generate');
      expect(decideThumbAction(missing, false, true)).toBe('generate');
    });

    it('regenerates a stale-version thumbnail even if its old file is still present', () => {
      expect(decideThumbAction(staleVersion, true, true)).toBe('generate');
      expect(decideThumbAction(staleVersion, false, true)).toBe('generate');
    });

    it('regenerates a fresh thumbnail whose file has vanished from disk', () => {
      expect(decideThumbAction(fresh, false, true)).toBe('generate');
    });

    it('gives up once attempts are exhausted and no file remains', () => {
      expect(decideThumbAction(attemptsExhausted, false, true)).toBe('give-up');
    });
  });

  describe('non-card width (e.g. the hero)', () => {
    it('serves a present file unconditionally — never consults thumb_version', () => {
      expect(decideThumbAction(missing, true, false)).toBe('serve');
      expect(decideThumbAction(fresh, true, false)).toBe('serve');
      expect(decideThumbAction(staleVersion, true, false)).toBe('serve');
      expect(decideThumbAction(attemptsExhausted, true, false)).toBe('serve');
    });

    it('generates a first-ever hero when there is no card frame yet and no file', () => {
      expect(decideThumbAction(missing, false, false)).toBe('generate');
    });

    it('generates when the card is fresh or stale-version but the hero file is absent', () => {
      expect(decideThumbAction(fresh, false, false)).toBe('generate');
      expect(decideThumbAction(staleVersion, false, false)).toBe('generate');
    });

    it('gives up without decoding once the card path has exhausted its attempts', () => {
      expect(decideThumbAction(attemptsExhausted, false, false)).toBe('give-up');
    });
  });
});
