/**
 * Compliance constants. Read these. Never violate them.
 * Source: docs/locked-spec.md "Compliance — never on `.com`" section.
 */

export const MCS_COMPLIANCE_FRAME = 
  'it shows really how it works, and people are signing up' as const;

/** What .com surfaces NEVER do. */
export const MCS_NEVER_ON_COM = [
  'Income claims or earnings projections',
  'Placement or queue-position-equals-leg-position promises',
  'AI prospecting (Michael is BA-facing only)',
  'Compensation cycle math, volume math, or rank math',
  'A current head count of the team (the 100,000 goal is named, the current count is not)',
  'Direct comparison to other teams or other companies',
  'THREE International branding (logo, name, eyebrow, or footer disclaimer)',
] as const;

/** Disclaimer rendered at the bottom of every .com surface. Verbatim from locked-spec.md. */
export const MCS_COM_DISCLAIMER =
  'Queue positions and momentum displays demonstrate team activity in real time and ' +
  'do not guarantee any final placement, compensation, or earnings outcome. ' +
  'Market figures cited from public sources are for context only. ' +
  'This page contains no income claims, placement promises, or guarantees of any kind.';
