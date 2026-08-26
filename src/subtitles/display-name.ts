/** Shown when neither the picker nor the URI yields a real filename. */
export const UNNAMED_SUBTITLE = 'Subtitle file';

/**
 * A MediaStore document id: `msf:345000`, `raw:12`. Not a filename, however
 * much it looks like one after decoding.
 */
const OPAQUE_DOCUMENT_ID = /^[a-z]+:\d+$/i;

/** Does this look like a filename a person would recognise? */
function plausible(candidate: string): boolean {
  return candidate.length > 0 && !OPAQUE_DOCUMENT_ID.test(candidate) && candidate.includes('.');
}

/**
 * Last path component, with any SAF volume prefix dropped:
 * `primary:Movies/Foo.srt` -> `Foo.srt`. A plain name passes through.
 */
function basename(raw: string): string {
  const afterVolume = raw.slice(raw.lastIndexOf(':') + 1);
  return afterVolume.slice(afterVolume.lastIndexOf('/') + 1);
}

/**
 * Best available human-readable name for a subtitle file.
 *
 * SAF hands back `content://…/document/<id>`, and expo-file-system's `File.name`
 * is that id's last path segment — which for the MediaStore provider is
 * `msf:345000`, an opaque row number. The external-storage provider is kinder:
 * its id decodes to `primary:Movies/Foo.srt`, so the real basename is sitting
 * right there behind a volume prefix and a percent-encoding.
 *
 * Try the reported name, fall back to digging the URI, and refuse to show an
 * id: a generic label is more honest than a number pretending to be a title.
 */
export function subtitleDisplayName(uri: string, reportedName?: string): string {
  if (reportedName) {
    // The reported name carries the same volume prefix as the id it came
    // from, so it needs the same trimming before it is fit to show.
    const reported = basename(reportedName);
    if (plausible(reported)) return reported;
  }

  let segment: string;
  try {
    segment = decodeURIComponent(uri.slice(uri.lastIndexOf('/') + 1));
  } catch {
    // A malformed percent-escape ('%zz') throws rather than passing through.
    return UNNAMED_SUBTITLE;
  }
  segment = segment.split('?')[0].split('#')[0];
  if (OPAQUE_DOCUMENT_ID.test(segment)) return UNNAMED_SUBTITLE;

  const base = basename(segment);
  return plausible(base) ? base : UNNAMED_SUBTITLE;
}
