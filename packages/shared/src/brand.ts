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

// ------- Brand roles -------
export const brandRoles = {
  identity: colors.gold,
  ceremony: colors.goldBright,
  live: colors.teal,
  action: colors.teal,
  progress: colors.teal,
  surface: colors.ink2,
  copy: colors.cream,
} as const;

export type BrandRole = keyof typeof brandRoles;

// ------- Logo assets -------
export const logoAssets = {
  navbar: {
    path: 'assets/logos/logo_navbar.png',
    cssVariable: '--tm-logo-navbar',
    cssClass: 'tm-logo--navbar',
    role: 'Sticky ribbons, app headers, and module headers.',
  },
  darkHero: {
    path: 'assets/logos/logo_dark_hero.png',
    cssVariable: '--tm-logo-dark-hero',
    cssClass: 'tm-logo--dark-hero',
    role: 'Welcome hero and prospect dashboard first viewport.',
  },
  icon: {
    path: 'assets/logos/logo_icon.png',
    cssVariable: '--tm-logo-icon',
    cssClass: 'tm-logo--icon',
    role: 'Compass badge, watermark, empty state seal, and compact status marks.',
  },
  darkSquare: {
    path: 'assets/logos/logo_dark_square.png',
    cssVariable: '--tm-logo-dark-square',
    cssClass: 'tm-logo--dark-square',
    role: 'Square cards, modals, loading states, and empty states.',
  },
  lightPrint: {
    path: 'assets/logos/logo_light_print.png',
    cssVariable: '--tm-logo-light-print',
    cssClass: 'tm-logo--light-print',
    role: 'Light-background or print use only.',
  },
} as const;

export type LogoAsset = keyof typeof logoAssets;

// ------- Shared primitive class contracts -------
export const brandPrimitiveClasses = {
  logo: {
    root: 'tm-logo',
    navbar: 'tm-logo tm-logo--navbar',
    darkHero: 'tm-logo tm-logo--dark-hero',
    icon: 'tm-logo tm-logo--icon',
    darkSquare: 'tm-logo tm-logo--dark-square',
    lightPrint: 'tm-logo tm-logo--light-print',
  },
  shell: {
    root: 'tm-shell',
    surface: 'tm-shell__surface',
  },
  commandRibbon: {
    root: 'tm-command-ribbon',
    brand: 'tm-command-ribbon__brand',
    actions: 'tm-command-ribbon__actions',
  },
  progressMeter: {
    root: 'tm-progress-meter',
    track: 'tm-progress-meter__track',
    value: 'tm-progress-meter__value',
    label: 'tm-progress-meter__label',
  },
  animatedCounter: {
    root: 'tm-animated-counter',
    value: 'tm-animated-counter__value',
    label: 'tm-animated-counter__label',
  },
  rollingTicker: {
    root: 'tm-rolling-ticker',
    track: 'tm-rolling-ticker__track',
    item: 'tm-rolling-ticker__item',
  },
  countdown: {
    root: 'tm-countdown',
    unit: 'tm-countdown__unit',
    value: 'tm-countdown__value',
    label: 'tm-countdown__label',
  },
  statusBadge: {
    root: 'tm-status-badge',
    identity: 'tm-status-badge tm-status-badge--identity',
    live: 'tm-status-badge tm-status-badge--live',
    progress: 'tm-status-badge tm-status-badge--progress',
    neutral: 'tm-status-badge tm-status-badge--neutral',
    warning: 'tm-status-badge tm-status-badge--warning',
  },
  lifecycleBadge: {
    root: 'tm-lifecycle-badge',
    draft: 'tm-lifecycle-badge tm-lifecycle-badge--draft',
    sent: 'tm-lifecycle-badge tm-lifecycle-badge--sent',
    active: 'tm-lifecycle-badge tm-lifecycle-badge--active',
    watched: 'tm-lifecycle-badge tm-lifecycle-badge--watched',
    callback: 'tm-lifecycle-badge tm-lifecycle-badge--callback',
    terminal: 'tm-lifecycle-badge tm-lifecycle-badge--terminal',
  },
} as const;

export type BrandPrimitive = keyof typeof brandPrimitiveClasses;

// ------- Typography -------
export const fonts = {
  display: "'Bebas Neue', sans-serif",
  body: "'DM Sans', sans-serif",
  mono: "'DM Mono', 'JetBrains Mono', monospace",
} as const;

export type FontToken = keyof typeof fonts;
