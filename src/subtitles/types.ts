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
