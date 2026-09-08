import { formatEpisodeLabel } from '@/library/episode-label';
import { normalizeTitle } from '@/library/normalize-title';
import { parseEpisode } from '@/library/parse-episode';

export interface MomentDisplay {
  title: string;
  episodeLabel: string | null;
}

/**
 * The name a moment is remembered by, derived exactly the way the group screen
 * derives a group title — no second naming scheme to keep in sync.
 *
 * Falls back to the raw filename when normalization leaves nothing, which
 * happens when the episode marker is the whole name ("S01E01.mkv"): a moment
 * card with a blank title would be unrecognizable.
 */
export function momentDisplay(filename: string): MomentDisplay {
  const { season, episode } = parseEpisode(filename);
  const label = formatEpisodeLabel(season, episode);
  const title = normalizeTitle(filename);
  return {
    title: title || filename,
    episodeLabel: label || null,
  };
}
