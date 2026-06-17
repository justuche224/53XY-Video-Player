function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatEpisodeLabel(season: number | null, episode: number | null): string {
  if (season === null) return '';
  return episode === null ? `S${pad2(season)}` : `S${pad2(season)}E${pad2(episode)}`;
}
