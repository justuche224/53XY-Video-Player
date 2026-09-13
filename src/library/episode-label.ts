function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatEpisodeLabel(season: number | null, episode: number | null): string {
  const s = season === null ? '' : `S${pad2(season)}`;
  const e = episode === null ? '' : `E${pad2(episode)}`;
  return s + e;
}
