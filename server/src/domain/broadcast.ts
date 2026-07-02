/**
 * ADMIN Section G — Broadcast composer domain (Chat #144 fan-out).
 *
 * Pure domain — no HTTP, no UI. The route file calls these; the in-memory
 * queue worker also calls into `markRecipientSending`/`markRecipientResult`
 * to advance per-recipient rows.
 *
 * Compliance posture (locked-spec 3.10 / 3.12 / 3.13):
 *   • BA-facing only. Audience resolution NEVER returns a prospect.
 *   • STOP exclusion (broadcast_optouts) is enforced HERE, not at the
 *     route, so every audience function honors it uniformly.
 *   • Interpolation is server-side. Rendered content is stored per
 *     recipient row so a later audit reads exactly what was sent.
 *
 * Triple-stack rule (locked-spec 3.14): broadcast records and recipient
 * rows write through `tripleStackWrite`. ChromaDB indexes the SMS / email
 * body so a future audit search ("what did Kevin send about X?") works.
 *
 * Mongo gateway gotchas baked in below (see services/tripleStack.ts):
 *   - `mongodb.insert`  needs `documents:` (plural array)
 *   - `mongodb.update`  is non-upsert; we branch on existence
 *   - `mongodb.query`   parameter is `filter:`; returns { count, documents }
 */

import { randomBytes } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { findBAByTmagId, listAllBAsForAdmin, type BAListItem } from './ba.js';
import { listLeaderTmagIds } from './adminMetrics.js';
import { appendAuditEntry } from './auditLog.js';
import type {
  McsBroadcastAudiencePreset,
  McsBroadcastAudiencePreview,
  McsBroadcastChannel,
  McsBroadcastEnqueueRequest,
  McsBroadcastOptoutReason,
  McsBroadcastOptoutRow,
  McsBroadcastRecipientRow,
  McsBroadcastRecipientStatus,
  McsBroadcastRecord,
  McsBroadcastSendTestRequest,
  McsBroadcastStatusCounts,
  McsBroadcastTemplate,
  McsAuditActor,
} from '@momentum/shared';
import { MCS_BROADCAST_LIMITS } from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLL_BROADCASTS = 'broadcasts';
const COLL_RECIPIENTS = 'broadcast_recipients';
const COLL_OPTOUTS = 'broadcast_optouts';
const CHROMA_BROADCASTS = 'mcs_broadcasts';

const MS_72H = 72 * 60 * 60 * 1000;
const MS_7D = 7 * 24 * 60 * 60 * 1000;
const MS_14D = 14 * 24 * 60 * 60 * 1000;

/**
 * Surfaced verbatim on the audience preview so Kevin knows exactly what
 * each preset resolves to today. Mirrors the LEADER_DETECTION_NOTE
 * pattern from adminMetrics.
 */
export const AT_RISK_NOTE =
  "'at_risk' = BA signed up >7 days ago AND (never logged in OR last login >14 days ago). " +
  'Proxies the structural "needs Kevin" signal until Michael-completion telemetry is wired.';

export const LEADER_NOTE =
  "'leaders' = Kevin-curated ∪ system-detected (binary-qualified AND ≥5 personally enrolled). " +
  'Binary qualification is upstream in THREE and not yet mirrored locally, so this set ' +
  'is small or empty today.';

/* ─── opt-out list ─────────────────────────────────────────────── */

/** Load the global STOP/optout set. Used everywhere audience is resolved. */
export async function loadOptoutTmagIds(): Promise<Set<string>> {
  const result = await gatewayCall<{ documents: McsBroadcastOptoutRow[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_OPTOUTS,
      filter: {},
      limit: 50_000,
    },
  );
  return new Set((result.documents ?? []).map((r) => r.tmagId));
}

/**
 * Append a BA to the permanent optout list. Idempotent — if the BA is
 * already opted out, the existing row stands. Exported so a future
 * Telnyx inbound-SMS webhook can call it when a STOP keyword arrives.
 */
export async function appendBroadcastOptout(input: {
  tmagId: string;
  reason: McsBroadcastOptoutReason;
  sourcePhone?: string | null;
  note?: string | null;
}): Promise<McsBroadcastOptoutRow> {
  const existing = await gatewayCall<{ documents: McsBroadcastOptoutRow[]; count: number }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_OPTOUTS,
      filter: { tmagId: input.tmagId },
      limit: 1,
    },
  );
  if (existing.count > 0 && existing.documents[0]) {
    return existing.documents[0];
  }
  const row: McsBroadcastOptoutRow = {
    tmagId: input.tmagId,
    reason: input.reason,
    addedAt: new Date().toISOString(),
    sourcePhone: input.sourcePhone ?? null,
    note: input.note ?? null,
  };
  await gatewayCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: COLL_OPTOUTS,
    documents: [{ _id: input.tmagId, ...row }],
  });
  return row;
}

/* ─── audience resolution ───────────────────────────────────────── */

/**
 * Resolve a preset to the concrete BA list, post-STOP-exclusion. The
 * second return value carries the breakdown the preview surfaces.
 */
export async function resolveAudience(
  preset: McsBroadcastAudiencePreset,
  channel: McsBroadcastChannel,
  customAudienceTmagIds: string[] | null,
): Promise<{ recipients: BAListItem[]; preview: McsBroadcastAudiencePreview }> {
  const optouts = await loadOptoutTmagIds();
  const allBas = await listAllBAsForAdmin(50_000);

  let candidates: BAListItem[];
  let provenanceNote: string | null = null;

  switch (preset) {
    case 'all':
      candidates = allBas;
      break;
    case 'first_72h': {
      const cutoff = Date.now() - MS_72H;
      candidates = allBas.filter((b) => {
        const t = Date.parse(b.joinedAt);
        return Number.isFinite(t) && t >= cutoff;
      });
      break;
    }
    case 'leaders': {
      const leaderIds = new Set(await listLeaderTmagIds());
      candidates = allBas.filter((b) => leaderIds.has(b.tmagId));
      provenanceNote = LEADER_NOTE;
      break;
    }
    case 'at_risk': {
      const now = Date.now();
      candidates = await filterAtRisk(allBas, now);
      provenanceNote = AT_RISK_NOTE;
      break;
    }
    case 'custom': {
      const set = new Set(customAudienceTmagIds ?? []);
      candidates = allBas.filter((b) => set.has(b.tmagId));
      break;
    }
  }

  const totalCandidates = candidates.length;
  const eligible = candidates.filter((b) => !optouts.has(b.tmagId));
  const excludedBySTOP = totalCandidates - eligible.length;

  const wantsEmail = channel === 'email' || channel === 'both';
  const wantsSms = channel === 'sms' || channel === 'both';
  const missingEmail = wantsEmail ? eligible.filter((b) => !b.email).length : 0;
  const missingPhone = wantsSms ? eligible.filter((b) => !b.phone).length : 0;

  const preview: McsBroadcastAudiencePreview = {
    preset,
    totalCandidates,
    excludedBySTOP,
    totalEligible: eligible.length,
    missingAddressEstimates: { missingEmail, missingPhone },
    provenanceNote,
  };

  return { recipients: eligible, preview };
}

async function filterAtRisk(allBas: BAListItem[], nowMs: number): Promise<BAListItem[]> {
  // Need lastLoginAt — listAllBAsForAdmin returned the projected list (no
  // lastLoginAt field). Query team_magnificent_members for the raw docs scoped to
  // baIds older than 7d to avoid pulling the whole roster twice.
  const olderThan7d = allBas.filter((b) => {
    const t = Date.parse(b.joinedAt);
    return Number.isFinite(t) && t <= nowMs - MS_7D;
  });
  if (olderThan7d.length === 0) return [];

  const result = await gatewayCall<{
    documents: Array<{ tmagId: string; lastLoginAt: string | null }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: 'team_magnificent_members',
    filter: { tmagId: { $in: olderThan7d.map((b) => b.tmagId) } },
    projection: { tmagId: 1, lastLoginAt: 1 },
    limit: olderThan7d.length,
  });
  const lastByTmagId = new Map<string, string | null>();
  for (const d of result.documents ?? []) {
    lastByTmagId.set(d.tmagId, d.lastLoginAt ?? null);
  }
  const loginCutoff = nowMs - MS_14D;
  return olderThan7d.filter((b) => {
    const last = lastByTmagId.get(b.tmagId);
    if (!last) return true;
    const t = Date.parse(last);
    return !Number.isFinite(t) || t < loginCutoff;
  });
}

/* ─── interpolation ────────────────────────────────────────────── */

interface InterpolateContext {
  firstName: string;
  lastName: string;
  fullName: string;
  senderName: string;
}

/**
 * Replace known tokens; strip any other `{{token}}` occurrence so a typo
 * never leaks raw template syntax to a recipient.
 *
 *   {{firstName}}  {{lastName}}  {{fullName}}  {{senderName}}
 */
export function interpolate(body: string, ctx: InterpolateContext): string {
  return body
    .replaceAll('{{firstName}}', ctx.firstName)
    .replaceAll('{{lastName}}', ctx.lastName)
    .replaceAll('{{fullName}}', ctx.fullName)
    .replaceAll('{{senderName}}', ctx.senderName)
    .replace(/\{\{[A-Za-z_][A-Za-z0-9_]*\}\}/g, '');
}

/* ─── template validation ──────────────────────────────────────── */

export class BroadcastValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Broadcast validation failed: ${issues.join('; ')}`);
    this.name = 'BroadcastValidationError';
  }
}

export function validateTemplate(
  channel: McsBroadcastChannel,
  template: McsBroadcastTemplate,
): void {
  const issues: string[] = [];
  const wantsSms = channel === 'sms' || channel === 'both';
  const wantsEmail = channel === 'email' || channel === 'both';

  if (wantsSms) {
    const t = template.smsText?.trim() ?? '';
    if (!t) issues.push('SMS text is required when channel includes sms.');
    if (t.length > MCS_BROADCAST_LIMITS.smsMaxChars) {
      issues.push(`SMS text exceeds ${MCS_BROADCAST_LIMITS.smsMaxChars} characters.`);
    }
  } else if (template.smsText && template.smsText.trim() !== '') {
    issues.push('SMS text must be empty when channel does not include sms.');
  }

  if (wantsEmail) {
    const subj = template.emailSubject?.trim() ?? '';
    const text = template.emailText?.trim() ?? '';
    if (!subj) issues.push('Email subject is required when channel includes email.');
    if (!text) issues.push('Email body is required when channel includes email.');
    if (subj.length > MCS_BROADCAST_LIMITS.emailSubjectMaxChars) {
      issues.push(
        `Email subject exceeds ${MCS_BROADCAST_LIMITS.emailSubjectMaxChars} characters.`,
      );
    }
    if (text.length > MCS_BROADCAST_LIMITS.emailTextMaxChars) {
      issues.push(`Email body exceeds ${MCS_BROADCAST_LIMITS.emailTextMaxChars} characters.`);
    }
  } else {
    if (template.emailSubject && template.emailSubject.trim() !== '') {
      issues.push('Email subject must be empty when channel does not include email.');
    }
    if (template.emailText && template.emailText.trim() !== '') {
      issues.push('Email body must be empty when channel does not include email.');
    }
  }

  if (issues.length > 0) throw new BroadcastValidationError(issues);
}

/* ─── id minting ───────────────────────────────────────────────── */

function mintBroadcastId(isTest: boolean): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const rand = randomBytes(3).toString('hex');
  return `${isTest ? 'btest' : 'bcast'}_${ts}_${rand}`;
}

function recipientRowId(broadcastId: string, tmagId: string): string {
  return `${broadcastId}::${tmagId}`;
}

/* ─── render a recipient row ──────────────────────────────────── */

function renderRecipient(
  broadcastId: string,
  ba: BAListItem,
  channel: McsBroadcastChannel,
  template: McsBroadcastTemplate,
  senderName: string,
): McsBroadcastRecipientRow {
  const [firstName, ...rest] = ba.fullName.split(' ');
  const lastName = rest.join(' ');
  const ctx: InterpolateContext = {
    firstName: firstName ?? '',
    lastName,
    fullName: ba.fullName,
    senderName,
  };
  const wantsSms = channel === 'sms' || channel === 'both';
  const wantsEmail = channel === 'email' || channel === 'both';

  const smsRendered =
    wantsSms && template.smsText ? interpolate(template.smsText, ctx) : null;
  const emailSubjectRendered =
    wantsEmail && template.emailSubject ? interpolate(template.emailSubject, ctx) : null;
  const emailTextRendered =
    wantsEmail && template.emailText ? interpolate(template.emailText, ctx) : null;

  const noAddress =
    (wantsEmail && !ba.email && (!wantsSms || !ba.phone)) ||
    (wantsSms && !ba.phone && (!wantsEmail || !ba.email));

  return {
    rowId: recipientRowId(broadcastId, ba.tmagId),
    broadcastId,
    recipientTmagId: ba.tmagId,
    recipientFullName: ba.fullName,
    recipientFirstName: firstName ?? '',
    recipientEmail: ba.email,
    recipientPhone: ba.phone,
    channel,
    smsRendered,
    emailSubjectRendered,
    emailTextRendered,
    status: noAddress ? 'skipped_no_address' : 'queued',
    smsMessageId: null,
    emailMessageId: null,
    failureReason: noAddress
      ? wantsEmail && !ba.email
        ? 'missing_email'
        : 'missing_phone'
      : null,
    attempts: 0,
    queuedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

/* ─── enqueue (G.5) ─────────────────────────────────────────────── */

/**
 * Create the broadcast record + per-recipient rows. Audience resolution
 * (including STOP exclusion) happens here. Returns the persisted
 * broadcast and the row count.
 *
 * The actual sending is decoupled — the in-memory worker
 * (`services/broadcastQueue.ts`) tails `broadcast_recipients` where
 * status='queued' and dispatches.
 */
export async function enqueueBroadcast(
  request: McsBroadcastEnqueueRequest,
  actor: McsAuditActor & { kind: 'admin' },
  actorDisplayName: string,
): Promise<{ broadcast: McsBroadcastRecord; recipientCount: number; excludedBySTOP: number }> {
  validateTemplate(request.channel, request.template);

  if (request.audiencePreset === 'custom') {
    const list = request.customAudienceTmagIds ?? [];
    if (list.length === 0) {
      throw new BroadcastValidationError(['Custom audience requires at least one BA ID.']);
    }
    if (list.length > MCS_BROADCAST_LIMITS.customAudienceMaxTmagIds) {
      throw new BroadcastValidationError([
        `Custom audience exceeds ${MCS_BROADCAST_LIMITS.customAudienceMaxTmagIds} BA IDs.`,
      ]);
    }
  }

  const { recipients, preview } = await resolveAudience(
    request.audiencePreset,
    request.channel,
    request.customAudienceTmagIds ?? null,
  );

  if (recipients.length === 0) {
    throw new BroadcastValidationError([
      'Audience resolved to zero eligible recipients (after STOP exclusion).',
    ]);
  }

  const broadcastId = mintBroadcastId(false);
  const now = new Date().toISOString();
  const broadcast: McsBroadcastRecord = {
    broadcastId,
    createdByTmagId: actor.tmagId,
    createdByDisplayName: actorDisplayName,
    createdAt: now,
    isTestSend: false,
    audiencePreset: request.audiencePreset,
    customAudienceTmagIds:
      request.audiencePreset === 'custom' ? request.customAudienceTmagIds ?? [] : null,
    channel: request.channel,
    template: request.template,
    recipientCount: recipients.length,
    status: 'queued',
    completedAt: null,
  };

  await tripleStackWrite({
    id: broadcastId,
    mongoCollection: COLL_BROADCASTS,
    mongoDoc: { ...broadcast },
    neo4j: {
      cypher:
        'MERGE (b:TmagBroadcast {broadcastId: $broadcastId}) ' +
        'SET b.createdAt = datetime($createdAt), b.channel = $channel, ' +
        '    b.audiencePreset = $audiencePreset, b.recipientCount = $recipientCount ' +
        'WITH b ' +
        'MATCH (a:TeamMagnificentMember {tmagId: $createdByTmagId}) ' +
        'MERGE (b)-[:SENT_BY]->(a)',
      params: {
        broadcastId,
        createdAt: now,
        channel: broadcast.channel,
        audiencePreset: broadcast.audiencePreset,
        recipientCount: broadcast.recipientCount,
        createdByTmagId: actor.tmagId,
      },
    },
    chroma: {
      collection: CHROMA_BROADCASTS,
      document: semanticDocument(broadcast),
      metadata: {
        broadcastId,
        channel: broadcast.channel,
        audiencePreset: broadcast.audiencePreset,
        createdAt: now,
      },
    },
  });

  // Per-recipient row inserts in batches (Mongo gateway limit safety).
  const rows = recipients.map((ba) =>
    renderRecipient(broadcastId, ba, request.channel, request.template, actorDisplayName),
  );
  await insertRecipientRows(rows);

  // Audit — every broadcast send appends an entry per G.6. Severity
  // 'critical' for full sends so the dashboard's needs-Kevin widget
  // surfaces them in the live event stream.
  await appendAuditEntry({
    actor,
    action: 'admin.broadcast_send',
    entity: { kind: 'audit_entry', id: broadcastId, displayLabel: `${request.channel} · ${preview.totalEligible}` },
    severity: 'critical',
    after: {
      broadcastId,
      audiencePreset: request.audiencePreset,
      channel: request.channel,
      recipientCount: rows.length,
      excludedBySTOP: preview.excludedBySTOP,
      missingAddress: preview.missingAddressEstimates,
    },
    reason: null,
    context: null,
  });

  return {
    broadcast,
    recipientCount: rows.length,
    excludedBySTOP: preview.excludedBySTOP,
  };
}

async function insertRecipientRows(rows: McsBroadcastRecipientRow[]): Promise<void> {
  if (rows.length === 0) return;
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    await gatewayCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection: COLL_RECIPIENTS,
      documents: slice.map((r) => ({ _id: r.rowId, ...r })),
    });
  }
}

function semanticDocument(b: McsBroadcastRecord): string {
  const parts = [
    `channel=${b.channel}`,
    `audience=${b.audiencePreset}`,
    `recipients=${b.recipientCount}`,
  ];
  if (b.template.smsText) parts.push(`sms="${b.template.smsText.slice(0, 400)}"`);
  if (b.template.emailSubject) parts.push(`subject="${b.template.emailSubject}"`);
  if (b.template.emailText) parts.push(`email="${b.template.emailText.slice(0, 600)}"`);
  return parts.join(' | ');
}

/* ─── send-test (G.4) ───────────────────────────────────────────── */

/**
 * Build the single-recipient test broadcast for Kevin. The route handler
 * inserts the row, dispatches inline (no queue indirection), and returns
 * the final row state so Kevin sees "sent" or "failed" immediately.
 *
 * Returns the broadcast record and the SINGLE rendered (still 'queued')
 * row. The route is responsible for the actual transport call so the
 * domain stays transport-free.
 */
export async function prepareSendTest(
  request: McsBroadcastSendTestRequest,
  actor: McsAuditActor & { kind: 'admin' },
  actorDisplayName: string,
): Promise<{ broadcast: McsBroadcastRecord; row: McsBroadcastRecipientRow }> {
  validateTemplate(request.channel, request.template);

  const ba = await findBAByTmagId(actor.tmagId);
  if (!ba) {
    throw new BroadcastValidationError([
      `Sending admin BA record not found for tmagId=${actor.tmagId}; cannot send test.`,
    ]);
  }
  const listItem: BAListItem = {
    tmagId: ba.tmagId,
    threeBaId: ba.threeBaId,
    fullName: `${ba.firstName} ${ba.lastName}`.trim(),
    email: ba.email ?? null,
    phone: ba.phone ?? null,
    timezone: ba.timezone ?? null,
    sponsorTmagId: ba.sponsorTmagId ?? null,
    sponsorName: null,
    joinedAt: ba.createdAt,
  };

  const broadcastId = mintBroadcastId(true);
  const now = new Date().toISOString();
  const broadcast: McsBroadcastRecord = {
    broadcastId,
    createdByTmagId: actor.tmagId,
    createdByDisplayName: actorDisplayName,
    createdAt: now,
    isTestSend: true,
    audiencePreset: 'custom',
    customAudienceTmagIds: [actor.tmagId],
    channel: request.channel,
    template: request.template,
    recipientCount: 1,
    status: 'queued',
    completedAt: null,
  };

  await tripleStackWrite({
    id: broadcastId,
    mongoCollection: COLL_BROADCASTS,
    mongoDoc: { ...broadcast },
    neo4j: {
      cypher:
        'MERGE (b:TmagBroadcast {broadcastId: $broadcastId}) ' +
        'SET b.createdAt = datetime($createdAt), b.channel = $channel, ' +
        '    b.audiencePreset = $audiencePreset, b.isTestSend = true, b.recipientCount = 1 ' +
        'WITH b ' +
        'MATCH (a:TeamMagnificentMember {tmagId: $createdByTmagId}) ' +
        'MERGE (b)-[:SENT_BY]->(a)',
      params: {
        broadcastId,
        createdAt: now,
        channel: broadcast.channel,
        audiencePreset: broadcast.audiencePreset,
        createdByTmagId: actor.tmagId,
      },
    },
    chroma: {
      collection: CHROMA_BROADCASTS,
      document: `[TEST] ${semanticDocument(broadcast)}`,
      metadata: {
        broadcastId,
        channel: broadcast.channel,
        isTestSend: true,
        createdAt: now,
      },
    },
  });

  const row = renderRecipient(broadcastId, listItem, request.channel, request.template, actorDisplayName);
  await insertRecipientRows([row]);

  // Audit the test send — info severity, distinct action so a 'critical'
  // dashboard filter never picks these up.
  await appendAuditEntry({
    actor,
    action: 'admin.broadcast_send_test',
    entity: {
      kind: 'audit_entry',
      id: broadcastId,
      displayLabel: `test · ${request.channel}`,
    },
    severity: 'info',
    after: { broadcastId, channel: request.channel },
    reason: null,
    context: null,
  });

  return { broadcast, row };
}

/* ─── per-recipient state advance (worker hooks) ─────────────── */

export async function markRecipientSending(rowId: string): Promise<void> {
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_RECIPIENTS,
    filter: { _id: rowId },
    update: {
      $set: { status: 'sending' as McsBroadcastRecipientStatus, startedAt: new Date().toISOString() },
      $inc: { attempts: 1 },
    },
  });
}

export async function markRecipientResult(
  rowId: string,
  patch: {
    status: McsBroadcastRecipientStatus;
    smsMessageId?: string | null;
    emailMessageId?: string | null;
    failureReason?: string | null;
  },
): Promise<void> {
  const set: Record<string, unknown> = {
    status: patch.status,
    finishedAt: new Date().toISOString(),
  };
  if (patch.smsMessageId !== undefined) set.smsMessageId = patch.smsMessageId;
  if (patch.emailMessageId !== undefined) set.emailMessageId = patch.emailMessageId;
  if (patch.failureReason !== undefined) set.failureReason = patch.failureReason;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_RECIPIENTS,
    filter: { _id: rowId },
    update: { $set: set },
  });
}

/* ─── status (G.5 polling) ─────────────────────────────────────── */

export async function getBroadcastById(broadcastId: string): Promise<McsBroadcastRecord | null> {
  const result = await gatewayCall<{ documents: McsBroadcastRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BROADCASTS,
    filter: { broadcastId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function listRecentBroadcasts(limit = 20): Promise<McsBroadcastRecord[]> {
  const result = await gatewayCall<{ documents: McsBroadcastRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_BROADCASTS,
    filter: {},
    sort: { createdAt: -1 },
    limit,
  });
  return result.documents ?? [];
}

export async function getBroadcastCounts(broadcastId: string): Promise<McsBroadcastStatusCounts> {
  const result = await gatewayCall<{ documents: McsBroadcastRecipientRow[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_RECIPIENTS,
    filter: { broadcastId },
    projection: { status: 1 },
    limit: 50_000,
  });
  const counts: McsBroadcastStatusCounts = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    skippedOptedOut: 0,
    skippedNoAddress: 0,
  };
  for (const row of result.documents ?? []) {
    switch (row.status) {
      case 'queued':
        counts.queued += 1;
        break;
      case 'sending':
        counts.sending += 1;
        break;
      case 'sent':
        counts.sent += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      case 'skipped_opted_out':
        counts.skippedOptedOut += 1;
        break;
      case 'skipped_no_address':
        counts.skippedNoAddress += 1;
        break;
    }
  }
  return counts;
}

export async function listRecentRecipientRows(
  broadcastId: string,
  limit = 50,
): Promise<McsBroadcastRecipientRow[]> {
  const result = await gatewayCall<{ documents: McsBroadcastRecipientRow[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_RECIPIENTS,
    filter: { broadcastId },
    sort: { finishedAt: -1, queuedAt: -1 },
    limit,
  });
  return result.documents ?? [];
}

/**
 * Pull queued rows for the worker. Capped to keep transport bursts sane.
 */
export async function claimQueuedRows(limit = 10): Promise<McsBroadcastRecipientRow[]> {
  const result = await gatewayCall<{ documents: McsBroadcastRecipientRow[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLL_RECIPIENTS,
    filter: { status: 'queued' },
    sort: { queuedAt: 1 },
    limit,
  });
  return result.documents ?? [];
}

/**
 * On worker boot, reset any 'sending' rows back to 'queued' so a
 * crash/restart mid-flight doesn't permanently strand them.
 */
export async function resetStuckSendingRows(): Promise<number> {
  const stuck = await gatewayCall<{ documents: McsBroadcastRecipientRow[]; count: number }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: COLL_RECIPIENTS,
      filter: { status: 'sending' },
      limit: 10_000,
    },
  );
  for (const row of stuck.documents ?? []) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: COLL_RECIPIENTS,
      filter: { _id: row.rowId },
      update: { $set: { status: 'queued' as McsBroadcastRecipientStatus, startedAt: null } },
    });
  }
  return stuck.count;
}

/**
 * Recompute a broadcast's top-level status from its recipient rows.
 * Called by the worker after each row resolves. Idempotent.
 */
export async function reconcileBroadcastStatus(broadcastId: string): Promise<McsBroadcastRecord | null> {
  const counts = await getBroadcastCounts(broadcastId);
  const broadcast = await getBroadcastById(broadcastId);
  if (!broadcast) return null;

  const inFlight = counts.queued + counts.sending;
  const terminal = counts.sent + counts.failed + counts.skippedOptedOut + counts.skippedNoAddress;
  const total = inFlight + terminal;

  let next: McsBroadcastRecord['status'];
  if (total === 0) next = broadcast.status;
  else if (inFlight === 0) next = 'complete';
  else if (counts.sending > 0 || counts.sent > 0 || counts.failed > 0) next = 'sending';
  else next = 'queued';

  if (next === broadcast.status && broadcast.completedAt) return broadcast;
  const completedAt = next === 'complete' ? new Date().toISOString() : broadcast.completedAt;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLL_BROADCASTS,
    filter: { broadcastId },
    update: { $set: { status: next, completedAt } },
  });
  return { ...broadcast, status: next, completedAt };
}
