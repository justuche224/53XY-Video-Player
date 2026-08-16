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
const FLAG_TOKENS = ['forced', 'sdh', 'cc'];

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
