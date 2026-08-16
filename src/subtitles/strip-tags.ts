/**
 * Remove inline markup that we deliberately do not render: SRT/VTT HTML-ish
 * tags (<i>, <b>, <v Roger>) and ASS override blocks ({\pos(...)}, {\c&H..}).
 * ASS line breaks (\N, \n) become real newlines and \h becomes a space.
 *
 * Italics are dropped rather than rendered: a rich-text renderer is not worth
 * it for subtitle emphasis.
 */
export function stripInlineTags(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\h/g, ' ');
}
