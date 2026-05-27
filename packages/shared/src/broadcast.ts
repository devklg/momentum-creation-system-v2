/**
 * ADMIN Section G — Kevin-only broadcast composer contract (Chat #144 fan-out).
 *
 * Build-checklist leaves #122–127 (G.1 … G.6):
 *   G.1  Composer with per-recipient interpolation + preview
 *   G.2  Audience selector — all / first_72h / leaders / at_risk / custom
 *   G.3  Channel selector — email / sms / both
 *   G.4  Send-test-to-Kevin button (one message, identical content)
 *   G.5  Queue master broadcast — triple-stack write of broadcast +
 *        per-recipient rows, async delivery via Telnyx + Resend
 *   G.6  Audit / consent guardrail — STOP keyword permanent exclusion list,
 *        every send audited
 *
 * This file is the SOLE wire contract between the server router and the
 * admin UI. Both import from `@momentum/shared`; neither defines these
 * types locally.
 *
 * Compliance posture (locked-spec 3.10 / 3.12 / 3.13):
 *   • BA-facing only. Broadcasts NEVER reach prospects. Never on `.com`.
 *   • SMS via Telnyx (3.13 — "Telnyx for SMS to BAs"). LIVE today.
 *   • Email via Resend. WIRED-DORMANT: the email leg builds fully, the
 *     transport stamps `emailDeliveryStatus='skipped'` when the key is
 *     unset or the from-domain is unverified. Kevin flips that switch.
 *   • Per-recipient interpolation is server-side. The client never sees
 *     rendered text for a third-party recipient.
 *   • STOP keyword exclusion is GLOBAL and enforced server-side at
 *     audience resolution. Any BA on `broadcast_optouts` is filtered out
 *     of every preset, including 'custom', regardless of how the audience
 *     is constructed.
 */

/* ─── G.2 · Audience ───────────────────────────────────────────── */

/**
 * Audience preset. The server resolves each preset to the concrete BA set;
 * the client never picks recipients directly except via 'custom' (an
 * explicit list of TM BA IDs Kevin pastes in).
 *
 *   all         — every BA on the team
 *   first_72h   — BAs whose signup is within the last 72 hours
 *                 (the cohort Kevin most often wants to nudge)
 *   leaders     — `listLeaderBaIds()` from adminMetrics: Kevin-curated ∪
 *                 system-detected (binary-qualified + ≥5 personal enrollments)
 *   at_risk     — BAs created >7 days ago with no recent login AND no
 *                 Michael completion. The structural "needs Kevin" set.
 *                 Provenance note carried on the response so Kevin knows
 *                 exactly what 'at_risk' resolves to today.
 *   custom      — Kevin pastes specific TM BA IDs; the server validates
 *                 and filters non-existent / opted-out entries.
 */
export type BroadcastAudiencePreset =
  | 'all'
  | 'first_72h'
  | 'leaders'
  | 'at_risk'
  | 'custom';

/** Channel for one broadcast. SMS-only and email-only are both valid. */
export type BroadcastChannel = 'sms' | 'email' | 'both';

/* ─── G.1 · Template ───────────────────────────────────────────── */

/**
 * Composer template. The shape carries both legs so a 'both' broadcast
 * doesn't need a parallel record; for 'sms' or 'email' the unused side
 * is null and validated server-side.
 *
 * Interpolation tokens are recognized by the server, NOT the client:
 *   {{firstName}}   recipient's first name
 *   {{lastName}}    recipient's last name
 *   {{fullName}}    "<firstName> <lastName>" trimmed
 *   {{senderName}}  Kevin's display name (the sending admin)
 *
 * Unknown tokens render as empty strings (we never echo `{{foo}}` to a
 * recipient — that leaks template internals).
 */
export interface BroadcastTemplate {
  /** SMS body (1200 char cap). Null when channel === 'email'. */
  smsText: string | null;
  /** Email subject (140 char cap). Null when channel === 'sms'. */
  emailSubject: string | null;
  /**
   * Email body. We send text/plain only this round (Resend accepts it,
   * and a plain-text broadcast is the lowest-risk surface for a
   * dormant-then-live transport). HTML is reserved for a later tranche.
   * Null when channel === 'sms'.
   */
  emailText: string | null;
}

/* ─── G.5 · Broadcast record ───────────────────────────────────── */

/**
 * Lifecycle of the broadcast as a whole. Per-recipient state lives on
 * BroadcastRecipientRow.
 *
 *   queued     — record written, recipients enqueued, worker has not
 *                yet picked any of them up
 *   sending    — at least one recipient is in 'sending' or has resolved;
 *                others remain 'queued'
 *   complete   — every recipient row is in a terminal state
 *                (sent | failed | skipped_opted_out). The worker stamps
 *                completedAt at this transition.
 *   failed     — pre-flight validation failed; no recipient rows exist
 */
export type BroadcastStatus = 'queued' | 'sending' | 'complete' | 'failed';

/** Per-recipient delivery state (one row per recipient × channel). */
export type BroadcastRecipientStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'skipped_opted_out'
  | 'skipped_no_address';

/** A broadcast as stored. The canonical row in `broadcasts`. */
export interface BroadcastRecord {
  broadcastId: string;
  /** TM BA ID of the sending admin (always Kevin or another ADMIN_BA_ID). */
  createdByBaId: string;
  createdByDisplayName: string;
  createdAt: string;
  /**
   * True when this is the G.4 send-test broadcast (audience = Kevin only).
   * Audit severity is 'info' for test, 'critical' for full sends.
   */
  isTestSend: boolean;
  audiencePreset: BroadcastAudiencePreset;
  /** Only populated when audiencePreset === 'custom'. */
  customAudienceBaIds: string[] | null;
  channel: BroadcastChannel;
  template: BroadcastTemplate;
  /** Count of recipient rows actually enqueued (post-exclusion). */
  recipientCount: number;
  status: BroadcastStatus;
  /** ISO when every recipient row reached a terminal state. */
  completedAt: string | null;
}

/**
 * One recipient row. We keep the rendered content per-recipient so a
 * later audit reads exactly what was sent — interpolation tokens get
 * lost on the wire if we only store the template.
 *
 * Stored in `broadcast_recipients`, joined to BroadcastRecord by
 * broadcastId. There may be 1 or 2 rows per recipient depending on
 * channel (currently 1 row per recipient with both legs on the same
 * row — the channel field on the row narrows what the worker actually
 * sends).
 */
export interface BroadcastRecipientRow {
  /** Composite id: `${broadcastId}::${recipientBaId}`. */
  rowId: string;
  broadcastId: string;
  recipientBaId: string;
  recipientFullName: string;
  recipientFirstName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  channel: BroadcastChannel;
  /** Rendered SMS body (interpolated). Null when channel === 'email'. */
  smsRendered: string | null;
  /** Rendered email subject. Null when channel === 'sms'. */
  emailSubjectRendered: string | null;
  /** Rendered email text body. Null when channel === 'sms'. */
  emailTextRendered: string | null;
  status: BroadcastRecipientStatus;
  /** Telnyx message id. Set when SMS succeeds. */
  smsMessageId: string | null;
  /** Resend message id. Set when email succeeds. */
  emailMessageId: string | null;
  /** Short reason string when status === 'failed' or 'skipped_*'. */
  failureReason: string | null;
  /** Number of send attempts so far (worker increments on retry). */
  attempts: number;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/* ─── G.6 · STOP / permanent exclusion list ────────────────────── */

/**
 * One row in `broadcast_optouts`. Append-only — a BA is excluded for
 * life once they text STOP (locked-spec 1.13 channel protection: a BA
 * who has revoked SMS consent never re-enters the channel unless they
 * explicitly opt back in, which is a separate compliance flow not
 * scoped this tranche).
 *
 * Sources today:
 *   'stop_keyword'  — inbound Telnyx SMS containing STOP (webhook wiring
 *                     is a later branch; the collection exists so manual
 *                     entries work today)
 *   'kevin_added'   — Kevin or another admin manually excluded the BA
 *                     via a future /admin tool; for now, direct insert
 */
export type BroadcastOptoutReason = 'stop_keyword' | 'kevin_added';

export interface BroadcastOptoutRow {
  baId: string;
  reason: BroadcastOptoutReason;
  addedAt: string;
  /** Phone number that texted STOP, when reason === 'stop_keyword'. */
  sourcePhone: string | null;
  /** Optional free-text note from Kevin when reason === 'kevin_added'. */
  note: string | null;
}

/* ─── G.2 · Audience preview response ──────────────────────────── */

/**
 * Response from GET /api/admin/broadcast/audience — drives the live
 * count next to the preset radio buttons. The server resolves the
 * preset and returns the count after STOP-exclusion is applied.
 *
 * `excludedBySTOP` is broken out so Kevin can SEE the guardrail
 * working ("12 BAs, 1 excluded by STOP" reads honest, not buried).
 */
export interface BroadcastAudiencePreview {
  preset: BroadcastAudiencePreset;
  /** Total BAs the preset would address before STOP exclusion. */
  totalCandidates: number;
  /** Count removed by the STOP exclusion list. */
  excludedBySTOP: number;
  /** Count actually addressable (totalCandidates − excludedBySTOP). */
  totalEligible: number;
  /**
   * BAs in the resolved set who have no email but channel includes email,
   * or no phone but channel includes sms. The worker will skip them with
   * status='skipped_no_address' and the audit will reflect it.
   */
  missingAddressEstimates: {
    missingEmail: number;
    missingPhone: number;
  };
  /**
   * Human-readable note when the preset's definition has caveats Kevin
   * should know about (mirrors LEADER_DETECTION_NOTE from the dashboard).
   * Example: for 'at_risk', describes the exact predicate.
   */
  provenanceNote: string | null;
}

export interface BroadcastAudiencePreviewResponse {
  ok: true;
  preview: BroadcastAudiencePreview;
}

/* ─── G.4 / G.5 · Send / status responses ──────────────────────── */

/**
 * Request to enqueue a master broadcast (G.5). The server resolves the
 * audience server-side; the client never enumerates third-party
 * recipients.
 */
export interface BroadcastEnqueueRequest {
  audiencePreset: BroadcastAudiencePreset;
  /** Required when audiencePreset === 'custom'; ignored otherwise. */
  customAudienceBaIds?: string[];
  channel: BroadcastChannel;
  template: BroadcastTemplate;
}

export interface BroadcastEnqueueResponse {
  ok: true;
  broadcastId: string;
  recipientCount: number;
  excludedBySTOP: number;
}

/**
 * G.4 — send-test-to-Kevin. Identical shape to the master enqueue minus
 * the audience preset (the audience is always Kevin's own BA). The
 * server generates ONE recipient row, sends it inline (no queue
 * indirection — Kevin is waiting for the result), and audits with
 * severity='info'.
 */
export interface BroadcastSendTestRequest {
  channel: BroadcastChannel;
  template: BroadcastTemplate;
}

export interface BroadcastSendTestResponse {
  ok: true;
  broadcastId: string;
  /** The single recipient row, post-render, post-send. */
  recipient: BroadcastRecipientRow;
}

/**
 * G.5 status view — what the BroadcastStatus component polls. Counts
 * are derived from the recipient rows; the worker advances them.
 */
export interface BroadcastStatusCounts {
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  skippedOptedOut: number;
  skippedNoAddress: number;
}

export interface BroadcastStatusResponse {
  ok: true;
  broadcast: BroadcastRecord;
  counts: BroadcastStatusCounts;
  /** Most recent 50 rows for the in-flight view, newest first. */
  recentRows: BroadcastRecipientRow[];
}

/* ─── Endpoint paths (single source of truth) ──────────────────── */

export const ADMIN_BROADCAST_PATHS = {
  /** GET — G.2 audience live count (query: preset, channel, customAudienceBaIds[]) */
  audience: '/api/admin/broadcast/audience',
  /** POST — G.4 send-test-to-Kevin (one recipient, inline) */
  sendTest: '/api/admin/broadcast/test',
  /** POST — G.5 enqueue master broadcast */
  enqueue: '/api/admin/broadcast',
  /** GET — G.5 status snapshot for one broadcast */
  status: (broadcastId: string) => `/api/admin/broadcast/${broadcastId}`,
  /** GET — list recent broadcasts (for landing on the composer page) */
  list: '/api/admin/broadcast/list',
} as const;

/* ─── Composer-side constraints (mirrored server validation) ───── */

export const BROADCAST_LIMITS = {
  smsMaxChars: 1200,
  emailSubjectMaxChars: 140,
  emailTextMaxChars: 20_000,
  customAudienceMaxBaIds: 500,
} as const;

/**
 * Tokens the server recognizes during interpolation. Anything not in
 * this set renders as empty (we don't echo `{{unknown}}` to recipients).
 */
export const BROADCAST_INTERPOLATION_TOKENS = [
  '{{firstName}}',
  '{{lastName}}',
  '{{fullName}}',
  '{{senderName}}',
] as const;
