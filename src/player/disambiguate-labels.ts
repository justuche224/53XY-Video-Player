/**
 * Number repeated labels so a list of tracks can be told apart.
 *
 * A container with two English subtitle streams reports the same `label` for
 * both, which leaves the tracks sheet showing "English" twice with no way to
 * know which one is selected or what the other is. Repeats become
 * "English (1)", "English (2)"; labels that appear once are left alone, since
 * numbering a unique row only adds noise.
 */
export function disambiguateLabels(labels: string[]): string[] {
  const totals = new Map<string, number>();
  for (const label of labels) totals.set(label, (totals.get(label) ?? 0) + 1);

  const seen = new Map<string, number>();
  return labels.map((label) => {
    if ((totals.get(label) ?? 0) < 2) return label;
    const n = (seen.get(label) ?? 0) + 1;
    seen.set(label, n);
    return `${label} (${n})`;
  });
}
