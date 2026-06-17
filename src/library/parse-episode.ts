import type { EpisodeInfo } from './types';

const SXXEXX = /\bs(\d{1,2})(?:e(\d{1,3}))?\b/i;
const NXNN = /\b(\d{1,2})x(\d{1,3})\b/i;

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
  return { season: null, episode: null };
}
