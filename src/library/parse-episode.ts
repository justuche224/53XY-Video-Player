import type { EpisodeInfo } from './types';

// Optional `x` covers the `S04xE01` hybrid (season-x-episode with S/E letters).
const SXXEXX = /\bs(\d{1,2})(?:x?e(\d{1,3}))?\b/i;
const NXNN = /\b(\d{1,2})x(\d{1,3})\b/i;
// Spelled-out forms: "Season 1 Episode 10", "Season 2 - Ep 3", "Season 3" alone.
const SEASON_WORD = /\bseason\s*(\d{1,2})\b(?:\s*[-–]?\s*\b(?:episode|ep)\s*(\d{1,3})\b)?/i;
const EPISODE_WORD = /\b(?:episode|ep)\s*(\d{1,3})\b/i;

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
  const ew = s.match(EPISODE_WORD);
  if (ew) {
    return { season: null, episode: Number(ew[1]) };
  }
  return { season: null, episode: null };
}
