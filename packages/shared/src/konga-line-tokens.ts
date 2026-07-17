/**
 * Konga Line D-23 visual authority.
 *
 * Values are transcribed from the canonical token block in
 * konga-line-direction-d23-vertical.html and scoped to Konga surfaces.
 */
export const MCS_KONGA_D23_TOKENS = {
  version: 'd23-v1',
  colors: {
    ground: '#05070F',
    slateHeritage: '#0F172A',
    panel: 'rgba(15,23,42,.74)',
    panelSolid: '#0E1730',
    edge: 'rgba(59,130,246,.32)',
    edgeDim: 'rgba(59,130,246,.16)',
    ink: '#E4EAF6',
    muted: '#8CA0C4',
    structureMotion: '#3B82F6',
    structureHighlight: '#6EA8FF',
    valueMoment: '#FACC15',
    livePulse: '#06B6D4',
    blueGlow: 'rgba(59,130,246,.55)',
    goldGlow: 'rgba(250,204,21,.5)',
    cyanGlow: 'rgba(6,182,212,.55)',
  },
  typography: {
    display: {
      family: 'Orbitron',
      weights: [800, 900],
      tracking: 'wide',
    },
    body: {
      family: 'Poppins',
      weights: [400, 500, 600],
    },
    telemetry: {
      family: 'Spline Sans Mono',
      weights: [500, 700],
      numericVariant: 'tabular-nums',
    },
  },
  orientation: {
    axis: 'vertical',
    direction: 'upward',
    destination: 'top',
    arrivals: 'bottom',
    ownNode: 'pinned',
    pauseOnHover: true,
    reducedMotionFallback: 'stationary_breathing_line',
    mobileNative: true,
  },
  gradient: {
    from: '#3B82F6',
    to: '#FACC15',
    allowedOn: ['wordmark', 'thesis_accent'],
    decorativeUseAllowed: false,
  },
  signalDiscipline: {
    structure: 'blue',
    joins: 'gold',
    live: 'cyan',
    glowWithoutSignalAllowed: false,
    simulatedEventsAllowed: false,
  },
} as const;

export type McsKongaD23Tokens = typeof MCS_KONGA_D23_TOKENS;

/** CSS custom properties for consumers that need the canonical render values. */
export const MCS_KONGA_D23_CSS_VARIABLES = {
  '--konga-ground': MCS_KONGA_D23_TOKENS.colors.ground,
  '--konga-slate': MCS_KONGA_D23_TOKENS.colors.slateHeritage,
  '--konga-panel': MCS_KONGA_D23_TOKENS.colors.panel,
  '--konga-panel-solid': MCS_KONGA_D23_TOKENS.colors.panelSolid,
  '--konga-edge': MCS_KONGA_D23_TOKENS.colors.edge,
  '--konga-edge-dim': MCS_KONGA_D23_TOKENS.colors.edgeDim,
  '--konga-ink': MCS_KONGA_D23_TOKENS.colors.ink,
  '--konga-muted': MCS_KONGA_D23_TOKENS.colors.muted,
  '--konga-blue': MCS_KONGA_D23_TOKENS.colors.structureMotion,
  '--konga-blue-hi': MCS_KONGA_D23_TOKENS.colors.structureHighlight,
  '--konga-gold': MCS_KONGA_D23_TOKENS.colors.valueMoment,
  '--konga-cyan': MCS_KONGA_D23_TOKENS.colors.livePulse,
  '--konga-glow-blue': MCS_KONGA_D23_TOKENS.colors.blueGlow,
  '--konga-glow-gold': MCS_KONGA_D23_TOKENS.colors.goldGlow,
  '--konga-glow-cyan': MCS_KONGA_D23_TOKENS.colors.cyanGlow,
} as const;
