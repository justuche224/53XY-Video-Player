import type { Moment } from './types';

export interface MomentSection {
  key: string;
  title: string;
  data: Moment[];
}

/**
 * Cluster a series' moments together while preserving the repo's
 * newest-first ordering: sections appear in the order their first moment
 * does, so the most recently captured title leads the screen.
 */
export function groupMoments(moments: Moment[]): MomentSection[] {
  const sections: MomentSection[] = [];
  const index = new Map<string, MomentSection>();

  for (const moment of moments) {
    let section = index.get(moment.title);
    if (!section) {
      section = { key: moment.title, title: moment.title, data: [] };
      index.set(moment.title, section);
      sections.push(section);
    }
    section.data.push(moment);
  }

  return sections;
}

/** Matches note text and title. Sections left empty are dropped entirely. */
export function filterMoments(sections: MomentSection[], query: string): MomentSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => ({
      ...s,
      data: s.data.filter(
        (m) =>
          m.title.toLowerCase().includes(q) || (m.note?.toLowerCase().includes(q) ?? false),
      ),
    }))
    .filter((s) => s.data.length > 0);
}

/**
 * Rows of `perRow` moments. `SectionList` has no `numColumns`, so the grid is
 * built by rendering each row as one item.
 */
export function chunkMoments(moments: Moment[], perRow: number): Moment[][] {
  // A non-positive width would loop forever; one-per-row is the safe reading.
  const width = perRow > 0 ? perRow : 1;
  const rows: Moment[][] = [];
  for (let i = 0; i < moments.length; i += width) {
    rows.push(moments.slice(i, i + width));
  }
  return rows;
}
