/**
 * Local wire shapes + FAST_START_MODULES mirror for the .team Fast Start
 * surface.
 *
 * API shapes and the module-metadata constant are declared locally
 * rather than imported from @momentum/shared — the shared `src` alias
 * is outside this app's rootDir and importing it trips TS6059 (lesson
 * lesson_team_app_cannot_import_shared_types_ts6059_chat120; see also
 * cockpit.tsx, invitations.tsx, video-library.tsx for the same pattern).
 *
 * SOURCE OF TRUTH for these shapes lives in
 * packages/shared/src/types.ts — the `FastStart*` exports there are the
 * authoritative versions. Keep this file in sync when types.ts changes
 * (append-only on the shared side per worktree hard rule #1).
 */

export type FastStartModuleId = 1 | 2 | 3 | 4 | 5;

export type FastStartModuleState =
  | 'not_started'
  | 'in_progress'
  | 'completed';

export interface FastStartModuleStatus {
  moduleId: FastStartModuleId;
  state: FastStartModuleState;
  startedAt: string | null;
  completedAt: string | null;
}

export interface FastStartProgressResponse {
  ok: true;
  modules: FastStartModuleStatus[];
  invitationsSent: number;
  complete: boolean;
}

export interface FastStartMarkStateResponse {
  ok: true;
  moduleId: FastStartModuleId;
  state: FastStartModuleState;
  startedAt: string | null;
  completedAt: string | null;
}

/**
 * Static module metadata — mirrors FAST_START_MODULES in
 * packages/shared/src/types.ts. Order is load-bearing; never reorder.
 */
export const FAST_START_MODULES: readonly {
  id: FastStartModuleId;
  slug: 'product' | 'comp-layer-1' | 'binary' | 'prospect-list' | 'team';
  eyebrow: string;
  title: string;
  blurb: string;
}[] = [
  {
    id: 1,
    slug: 'product',
    eyebrow: 'MODULE 01 · PRODUCT',
    title: 'The Product',
    blurb:
      'GLP-THREE and the six-pillar product story. What you take, what you share, why people stay.',
  },
  {
    id: 2,
    slug: 'comp-layer-1',
    eyebrow: 'MODULE 02 · COMPENSATION',
    title: 'Comp Plan, Layer 1',
    blurb: 'How the money actually works. Active, Qualified, and the 300 + 600 = 900 CV cycle.',
  },
  {
    id: 3,
    slug: 'binary',
    eyebrow: 'MODULE 03 · STRUCTURE',
    title: 'The Binary as Two Legs',
    blurb:
      'Power Leg and Pay Leg, no breakage, and why first-mover position is structural math.',
  },
  {
    id: 4,
    slug: 'prospect-list',
    eyebrow: 'MODULE 04 · PROSPECTS',
    title: 'Build Your Prospect List',
    blurb: 'Names list, mindset, and where Ivory comes in. The system you write FROM, not into.',
  },
  {
    id: 5,
    slug: 'team',
    eyebrow: 'MODULE 05 · TEAM',
    title: 'Build Your Team',
    blurb: 'NOT "find two and stop." Your first two activate you. A team is the business.',
  },
] as const;
