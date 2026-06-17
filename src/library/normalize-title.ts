// Matches the first season/episode marker; the show name is everything before it.
const EPISODE_MARKER = /\b(s\d{1,2}(e\d{1,3})?|\d{1,2}x\d{1,3}|season\s*\d+|episode\s*\d+)\b/i;
// Promo junk that signals the title has ended (handles, "JOIN ...", urls).
const PROMO_MARKER = /(@\w+|\bjoin\b|\bwww\.|https?:\/\/)/i;
// Quality / release-group tokens to drop from movie titles.
const QUALITY_TAGS =
  /\b(480p|720p|1080p|2160p|4k|x264|x265|h\.?264|h\.?265|hevc|bluray|brrip|bdrip|webrip|web-?dl|hdrip|dvdrip|aac|ac3|dts|hdr|10bit|remux|proper|repack|hq|english)\b/gi;
const YEAR = /\b(19|20)\d{2}\b/g;
const BRACKETED = /[[({][^\])}]*[\])}]/g;

export function normalizeTitle(filename: string): string {
  // 1. strip extension
  let s = filename.replace(/\.[a-z0-9]{2,4}$/i, '');
  // 2. normalize separators
  s = s.replace(/[._]+/g, ' ');
  // 3. remove bracketed content e.g. (2010), [1080p]
  s = s.replace(BRACKETED, ' ');
  // 4. cut at the first episode/season marker, if any
  const ep = s.match(EPISODE_MARKER);
  if (ep && ep.index !== undefined) {
    s = s.slice(0, ep.index);
  } else {
    // movie: cut at promo junk, then drop quality tags
    const promo = s.match(PROMO_MARKER);
    if (promo && promo.index !== undefined) s = s.slice(0, promo.index);
    s = s.replace(QUALITY_TAGS, ' ');
  }
  // 5. drop standalone years and collapse whitespace
  s = s.replace(YEAR, ' ').replace(/\s+/g, ' ').trim();
  return s;
}
