/**
 * ADMIN Section H — Live Operations contract (Chat #144 fan-out).
 *
 * The four H leaves from project-wireframe.md / build-checklist:
 *   H.1  Real-time usage strip   — active .team/.com sessions, events/min,
 *                                  gateway p50/p95 over the last minute
 *   H.2  Growth stat cards       — BAs and prospects added in 24h / 7d / 30d
 *   H.3  Holding-tank live grid  — every active placement slot, colored by
 *                                  age in tank, click to open prospect panel
 *   H.4  Conversion funnels      — prospect funnel + BA activation funnel,
 *                                  toggleable in the UI
 *
 * This file is the SOLE wire contract between H-server and H-UI. Both
 * worktrees import from `@momentum/shared`; neither defines these types
 * locally. Changes to this file require both worktrees to agree.
 *
 * Compliance: /admin-only (ADMIN Design Section H). H surfaces aggregated
 * operational telemetry, never per-prospect identifying detail in the
 * usage strip / growth cards / funnels. The live grid DOES surface
 * per-prospect identity because clicking a slot opens the existing 4.D
 * prospect detail panel — that's intentional and audited.
 *
 * SSE vs. JSON poll:
 *   - H.1 usage strip is SSE (the spec says "real-time")
 *   - H.2/H.3/H.4 are JSON GETs, refreshed by the UI on an interval
 *   - H.1's SSE stream is keepalive at 30s heartbeat, same as poolEvents
 */

import type { AdminDashboardFilter } from './types.js';

/* ─── H.1 · Real-time usage strip (SSE) ─────────────────────────── */

/**
 * One snapshot of the live usage strip. Pushed at ~1s cadence on the SSE
 * stream when any value has changed; otherwise a heartbeat is sent every
 * 30s (same pattern as the prospect-dashboard SSE).
 *
 * `activeDashboardViewers` counts the live SSE subscribers on the
 * prospect-dashboard channel (services/poolEvents.activePlacementSubscriberCount).
 * `activeAdminSessions` counts open admin SSE subscribers on this very
 * channel — useful as a sanity check (it should be ≥ 1 whenever the
 * strip is rendering for Kevin).
 *
 * `gatewayLatencyMsP50/P95` is the Universal Gateway round-trip latency
 * measured server-side over the last 60 seconds; null when no calls
 * happened in that window.
 */
export interface AdminLiveUsageSample {
  sampledAt: string; // ISO-8601
  activeDashboardViewers: number;
  activeAdminSessions: number;
  eventsPerMinute: number;
  gatewayLatencyMsP50: number | null;
  gatewayLatencyMsP95: number | null;
}

/** SSE event kinds on GET /api/admin/live-ops/usage/stream. */
export type AdminLiveUsageStreamEvent =
  | { kind: 'snapshot'; sample: AdminLiveUsageSample }
  | { kind: 'heartbeat'; at: string };

/* ─── H.2 · Growth stat cards (JSON GET) ───────────────────────── */

/**
 * Card window — three cards rendered side-by-side. Each card shows the
 * count over the window plus delta vs. the previous equal window
 * (e.g. last 24h vs. the 24h before that).
 */
export interface AdminGrowthCard {
  window: '24h' | '7d' | '30d';
  basAdded: number;
  prospectsPlaced: number;
  enrollments: number;
  basAddedDelta: number; // current − previous, signed
  prospectsPlacedDelta: number;
  enrollmentsDelta: number;
}

export interface AdminGrowthCardsResponse {
  appliedFilter: AdminDashboardFilter;
  generatedAt: string;
  cards: [AdminGrowthCard, AdminGrowthCard, AdminGrowthCard]; // 24h, 7d, 30d
}

/* ─── H.3 · Holding-tank live grid (JSON GET) ──────────────────── */

/**
 * One placement slot on the grid. The grid is rendered as a continuous
 * stream of squares, newest first; the UI groups them by `ageBucket`
 * for the color treatment but the server returns the raw rows so the
 * UI controls bucketing thresholds.
 *
 * IDENTITY surfaced here is intentional (ADMIN Design H.3 says
 * "hover detail, click → prospect panel") — this is /admin only and
 * audited. Never reuse this shape for non-admin surfaces.
 */
export interface AdminLiveGridSlot {
  prospectId: string;
  positionNumber: number;
  prospectFirstName: string;
  prospectLastInitial: string;
  prospectCity: string;
  prospectStateOrRegion: string;
  sponsorTmagId: string;
  sponsorFullName: string;
  placedAt: string;
  ageDays: number; // floor((now − placedAt) / 24h)
  ageBucket: 'fresh' | 'warming' | 'aging' | 'stale'; // 0–6, 7–20, 21–41, 42–56
}

export interface AdminLiveGridResponse {
  appliedFilter: AdminDashboardFilter;
  generatedAt: string;
  totalActive: number;
  /** Sorted newest-placedAt first. UI may page client-side. */
  slots: AdminLiveGridSlot[];
}

/* ─── H.4 · Conversion funnels (JSON GET) ──────────────────────── */

/**
 * Two parallel funnels the UI toggles between.
 *
 *   - prospect funnel:  minted → clicked → video_started → video_complete
 *                       → enrolled
 *   - BA activation:    signed_up → welcomed → steve_discovery_done →
 *                       first_invite_sent → first_video_complete →
 *                       first_enrollment
 *
 * Each stage carries a count and the cumulative conversion ratio from
 * the first stage. The UI renders a horizontal funnel; bars width =
 * stage / first.
 */
export type AdminFunnelKind = 'prospect' | 'ba_activation';

export interface AdminFunnelStage {
  key: string;
  label: string;
  count: number;
  /** Conversion from the first stage (0–1). null when first-stage count = 0. */
  conversionFromStart: number | null;
}

export interface AdminFunnelResponse {
  kind: AdminFunnelKind;
  appliedFilter: AdminDashboardFilter;
  generatedAt: string;
  stages: AdminFunnelStage[];
}

/* ─── Endpoint paths (single source of truth for both worktrees) ── */

export const ADMIN_LIVE_OPS_PATHS = {
  /** SSE — H.1 usage strip stream */
  usageStream: '/api/admin/live-ops/usage/stream',
  /** GET — H.2 growth cards */
  growthCards: '/api/admin/live-ops/growth',
  /** GET — H.3 live grid */
  liveGrid: '/api/admin/live-ops/grid',
  /** GET — H.4 funnel (query param `kind=prospect|ba_activation`) */
  funnel: '/api/admin/live-ops/funnel',
} as const;
