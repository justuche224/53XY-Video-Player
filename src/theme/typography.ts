import type { TextStyle } from 'react-native';

// Font-family keys must match the names passed to useFonts() in _layout.tsx.
// Body text intentionally has no family → system default (Roboto on Android).
export const FONTS = {
  display: 'SpaceGrotesk_600SemiBold',
  displayBold: 'SpaceGrotesk_700Bold',
} as const;

export type TypeVariant =
  | 'display' | 'headline' | 'title' | 'titleSmall' | 'body' | 'label' | 'meta' | 'episode';

export interface TypeStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: TextStyle['fontWeight'];
  fontFamily?: string;
}

export const TYPOGRAPHY: Record<TypeVariant, TypeStyle> = {
  display:    { fontSize: 28, lineHeight: 34, fontWeight: '700', fontFamily: FONTS.displayBold },
  headline:   { fontSize: 22, lineHeight: 28, fontWeight: '600', fontFamily: FONTS.display },
  title:      { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  titleSmall: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  body:       { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label:      { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  meta:       { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  episode:    { fontSize: 12, lineHeight: 16, fontWeight: '700' },
};
