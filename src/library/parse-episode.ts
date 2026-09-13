import type { EpisodeInfo } from './types';

// Optional `x` covers the `S04xE01` hybrid; optional whitespace covers
// separated forms like `S01.E05` / `S01_E05` (separators become spaces first).
const SXXEXX = /\bs(\d{1,2})(?:\s*x?\s*e(\d{1,3}))?\b/i;
const NXNN = /\b(\d{1,2})x(\d{1,3})\b/i;
// Spelled-out forms: "Season 1 Episode 10", "Season 2 - Ep 3", "Season 3" alone.
const SEASON_WORD = /\bseason\s*(\d{1,2})\b(?:\s*[-–]?\s*\b(?:episode|ep)\s*(\d{1,3})\b)?/i;
// Episode without a season: "Episode 7", "Ep 3", "EP12", "E05". Bare `e` must
// touch its digits so words like "Edge"/"Ex" can never match.
const EPISODE_ONLY = /\b(?:episode\s*|ep\s*|e)(\d{1,3})\b/i;
// A number delimited by a dash (anime "Show - 09", scene "Show - 216 - Title").
const DASH_NUMBER = /\s[-–]\s*(\d{1,4})\b/;
const YEAR = /^(19|20)\d{2}$/;

function fromDashCode(code: string): EpisodeInfo {
  if (code.length <= 2) return { season: null, episode: Number(code) };
  if (YEAR.test(code)) return { season: null, episode: null };
  // 3-4 digit code: 1-2 digit season followed by a 2-digit episode (216 -> S2E16).
  return { season: Number(code.slice(0, -2)), episode: Number(code.slice(-2)) };
}

export function parseEpisode(filename: string): EpisodeInfo {
  const s = filename.replace(/[._]+/g, ' ');
  const sxx = s.match(SXXEXX);
  if (sxx) {
    return {
      season: Number(sxx[1]),
      episode: sxx[2] !== undefined ? Number(sxx[2]) : null,
    };
  }
  const nx = s.match(NXNN);
  if (nx) {
    return { season: Number(nx[1]), episode: Number(nx[2]) };
  }
  const sw = s.match(SEASON_WORD);
  if (sw) {
    return {
      season: Number(sw[1]),
      episode: sw[2] !== undefined ? Number(sw[2]) : null,
    };
  }
  const eo = s.match(EPISODE_ONLY);
  if (eo) {
    return { season: null, episode: Number(eo[1]) };
  }
  const dn = s.match(DASH_NUMBER);
  if (dn) {
    return fromDashCode(dn[1]);
  }
  return { season: null, episode: null };
}
