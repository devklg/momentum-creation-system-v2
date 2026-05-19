/**
 * Team Magnificent brand tokens. Single source of truth.
 * Locked across all three surfaces — .com (cinematic), .team (focused), admin (dense).
 * Source: docs/Team-Magnificent-App-Style-Guide.html + docs/locked-spec.md.
 */

// ------- Color palette -------
export const colors = {
  ink: '#0A0A0A',
  ink2: '#0F0F0F',
  gold: '#C9A84C',
  goldBright: '#F5C030',
  teal: '#2DD4BF',
  cream: '#F5EFE6',
  creamMute: 'rgba(245, 239, 230, 0.72)',
  creamFaint: 'rgba(245, 239, 230, 0.48)',
  line: 'rgba(245, 239, 230, 0.12)',
} as const;

export type ColorToken = keyof typeof colors;

// ------- Typography -------
export const fonts = {
  display: "'Bebas Neue', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', 'JetBrains Mono', monospace",
} as const;

export type FontToken = keyof typeof fonts;
