import type { Moment } from './types';

export const MANIFEST_VERSION = 1;

export function toManifestJson(moments: Moment[]): string {
  return JSON.stringify({ version: MANIFEST_VERSION, moments });
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * One entry, or null if it is unusable. Required fields are the ones a card
 * cannot render without; everything else falls back to null, which every
 * consumer already handles (a frameless moment shows a placeholder).
 */
function parseMoment(raw: unknown): Moment | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = str(r.id);
  const title = str(r.title);
  const filename = str(r.filename);
  const positionMs = num(r.positionMs);
  const createdAt = num(r.createdAt);
  if (id === null || title === null || filename === null) return null;
  if (positionMs === null || createdAt === null) return null;

  return {
    id,
    videoId: str(r.videoId),
    positionMs,
    createdAt,
    frameUri: str(r.frameUri),
    note: str(r.note),
    title,
    episodeLabel: str(r.episodeLabel),
    filename,
    folder: str(r.folder),
    videoUri: str(r.videoUri),
    durationMs: num(r.durationMs),
  };
}

/**
 * Tolerant by design. This file is the durable copy of the user's moments and
 * is read on a fresh install, so a single bad entry — or a manifest from a
 * newer version of the app — must never cost them the rest.
 */
export function fromManifestJson(json: string): Moment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  if (typeof parsed !== 'object' || parsed === null) return [];
  const { moments } = parsed as { moments?: unknown };
  if (!Array.isArray(moments)) return [];
  return moments.map(parseMoment).filter((m): m is Moment => m !== null);
}
