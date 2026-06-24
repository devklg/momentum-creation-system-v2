/**
 * LEGACY Michael → founder handoff (retired scored-Michael path).
 *
 * Reconciled 2026-06-24: Steve owns Discovery + Success Profile without
 * scoring; Michael is the Training Agent and Daily Success Coach and does not classify. This module remains
 * for historical handoff reads only. New Michael ingests no longer call it.
 *
 * Mechanics:
 *   1. Persist a `michael_founder_handoffs` record (triple-stacked → Mongo +
 *      Neo4j + Chroma) so founders have a durable, searchable queue and the
 *      transcript/score feeds GraphRAG.
 *   2. Publish an in-process event for any live founder surface (mirrors the
 *      poolEvents / michaelEvents pattern).
 *   3. Dispatch a notification to each founder via Telnyx SMS + Resend email —
 *      DORMANT-SAFE: when the provider key is unset (dev), the send throws
 *      Config error, we catch it and record 'skipped'. The handoff record is
 *      authoritative regardless; founders see it on their read either way.
 *
 * Idempotent on baId (handoffId = `MFH-${baId}`): re-ingest (re-score) updates
 * the record rather than firing a second handoff.
 */

import { EventEmitter } from 'node:events';
import type {
  MichaelClassification,
  MichaelFounderHandoff,
  MichaelSuccessProfile,
} from '@momentum/shared';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { sendSms, TelnyxError, TelnyxConfigError } from '../services/telnyx.js';
import { sendEmail, ResendError, ResendConfigError } from '../services/resend.js';

const HANDOFFS_COLLECTION = 'michael_founder_handoffs';
const CHROMA_HANDOFFS = 'mcs_michael_handoffs';

// ── In-process event bus (live founder surface fan-out) ────────────────────

const HANDOFF_EVENT = 'michael_founder_handoff' as const;

class FounderHandoffBus extends EventEmitter {}
const bus = new FounderHandoffBus();
bus.setMaxListeners(1_000);

export interface FounderHandoffSubscription {
  unsubscribe: () => void;
}

export function publishFounderHandoff(handoff: MichaelFounderHandoff): void {
  bus.emit(HANDOFF_EVENT, handoff);
}

export function subscribeFounderHandoffs(
  handler: (handoff: MichaelFounderHandoff) => void,
): FounderHandoffSubscription {
  bus.on(HANDOFF_EVENT, handler);
  let detached = false;
  return {
    unsubscribe: () => {
      if (detached) return;
      detached = true;
      bus.off(HANDOFF_EVENT, handler);
    },
  };
}

// ── Chroma collection bootstrap (lazy, idempotent) ─────────────────────────

let collectionBootstrap: Promise<void> | null = null;

async function ensureHandoffCollection(): Promise<void> {
  if (collectionBootstrap) return collectionBootstrap;
  collectionBootstrap = (async () => {
    // Existence-first: the gateway HTTP path reports a duplicate create as a
    // generic 500, so check via list_collections rather than an error string.
    const existing = await gatewayCall<{ collections?: Array<{ name: string }> }>(
      'chromadb', 'list_collections', {},
    );
    const present = (existing?.collections ?? []).some((c) => c.name === CHROMA_HANDOFFS);
    if (present) return;
    await gatewayCall('chromadb', 'create_collection', {
      name: CHROMA_HANDOFFS,
      metadata: {
        branch: 'feat/mcs-michael',
        wireframe_leaf: '3.2',
        purpose: 'Michael founder-handoff queue (profile + classification)',
      },
    });
  })();
  return collectionBootstrap;
}

// ── Founder recipient lookup ───────────────────────────────────────────────

interface FounderRecipient {
  baId: string;
  firstName: string;
  phone: string | null;
  email: string | null;
}

/** Resolve founder contact rows from ADMIN_BA_IDS. Best-effort: a founder with
 *  no BA record is skipped (the handoff record still lands). */
async function getFounderRecipients(): Promise<FounderRecipient[]> {
  const ids = env.ADMIN_BA_IDS;
  if (ids.length === 0) return [];
  const result = await gatewayCall<{
    documents: Array<{
      baId?: string;
      threeBaId?: string;
      firstName?: string;
      phone?: string | null;
      email?: string | null;
    }>;
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { $or: [{ baId: { $in: ids } }, { threeBaId: { $in: ids } }] },
    limit: 25,
  });
  return result.documents.map((d) => ({
    baId: d.baId ?? d.threeBaId ?? '',
    firstName: d.firstName ?? '',
    phone: d.phone?.trim() || null,
    email: d.email?.trim() || null,
  }));
}

// ── Dormant-safe dispatch ──────────────────────────────────────────────────

function handoffSmsText(baFirstName: string, profile: MichaelSuccessProfile): string {
  return (
    `Michael handoff: ${baFirstName} just finished their interview — ` +
    `${profile.classification.tierLabel} (${profile.classification.weightedTotal}/100). ` +
    `Ready for Fast Start + orientation. Profile in the cockpit.`
  ).slice(0, 1600);
}

function handoffEmailHtml(baFirstName: string, profile: MichaelSuccessProfile): string {
  const strengths = profile.strengths.map((s) => `<li>${s}</li>`).join('');
  const focus = profile.sponsorFocus.map((s) => `<li>${s}</li>`).join('');
  return [
    `<h2>${baFirstName} is ready for Fast Start</h2>`,
    `<p><strong>${profile.classification.tierLabel}</strong> · ${profile.classification.weightedTotal}/100</p>`,
    `<p>${profile.headline}</p>`,
    `<h3>Strengths</h3><ul>${strengths}</ul>`,
    `<h3>Where to focus support</h3><ul>${focus}</ul>`,
    `<p style="color:#888;font-size:12px">${profile.signedBy}</p>`,
  ].join('');
}

type DispatchChannel = 'sent' | 'skipped' | 'failed';

/** Send to one founder over one channel; never throws — maps the outcome. */
async function dispatchSms(to: string, text: string): Promise<DispatchChannel> {
  try {
    await sendSms({ to, text });
    return 'sent';
  } catch (err) {
    if (err instanceof TelnyxConfigError) return 'skipped';
    if (err instanceof TelnyxError) return 'failed';
    return 'failed';
  }
}

async function dispatchEmail(
  to: string,
  subject: string,
  html: string,
): Promise<DispatchChannel> {
  try {
    await sendEmail({ to, subject, html });
    return 'sent';
  } catch (err) {
    if (err instanceof ResendConfigError) return 'skipped';
    if (err instanceof ResendError) return 'failed';
    return 'failed';
  }
}

/** Collapse per-recipient channel results into one status. 'sent' if any send
 *  succeeded; 'failed' if any attempt failed and none succeeded; else 'skipped'
 *  (dormant key / no recipients). */
function collapse(results: DispatchChannel[]): DispatchChannel {
  if (results.some((r) => r === 'sent')) return 'sent';
  if (results.some((r) => r === 'failed')) return 'failed';
  return 'skipped';
}

// ── Fire ────────────────────────────────────────────────────────────────────

/**
 * Build + persist + dispatch the founder handoff for a completed interview.
 * Idempotent on baId. Returns the handoff record (also published + persisted).
 */
export async function fireFounderHandoff(args: {
  baId: string;
  baFirstName: string;
  sponsorBaId: string | null;
  classification: MichaelClassification;
  successProfile: MichaelSuccessProfile;
  completedAt: string;
}): Promise<MichaelFounderHandoff> {
  const firedAt = new Date().toISOString();
  const recipients = await getFounderRecipients();
  const founderBaIds = recipients.map((r) => r.baId).filter(Boolean);

  // Dispatch (dormant-safe). Aggregate per-channel across all founders.
  const smsResults: DispatchChannel[] = [];
  const emailResults: DispatchChannel[] = [];
  const smsText = handoffSmsText(args.baFirstName, args.successProfile);
  const emailHtml = handoffEmailHtml(args.baFirstName, args.successProfile);
  const emailSubject = `${args.baFirstName} is ready for Fast Start — ${args.classification.tierLabel}`;

  for (const r of recipients) {
    if (r.phone) smsResults.push(await dispatchSms(r.phone, smsText));
    if (r.email) emailResults.push(await dispatchEmail(r.email, emailSubject, emailHtml));
  }

  const handoffId = `MFH-${args.baId}`;
  const handoff: MichaelFounderHandoff = {
    handoffId,
    baId: args.baId,
    baFirstName: args.baFirstName,
    sponsorBaId: args.sponsorBaId,
    tier: args.classification.tier,
    tierLabel: args.classification.tierLabel,
    weightedTotal: args.classification.weightedTotal,
    successProfile: args.successProfile,
    completedAt: args.completedAt,
    firedAt,
    founderBaIds,
    fastStartReady: true,
    dispatch: {
      sms: collapse(smsResults),
      email: collapse(emailResults),
    },
  };

  // Persist (idempotent on _id). branch-on-existence per mongo update gotcha.
  const existing = await gatewayCall<{ documents: unknown[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: HANDOFFS_COLLECTION,
    filter: { _id: handoffId },
    limit: 1,
  });

  const chromaDoc = [
    `Michael founder-handoff for BA ${args.baId} (${args.baFirstName}).`,
    `Classification: ${args.classification.tierLabel} ${args.classification.weightedTotal}/100.`,
    `Strengths: ${args.successProfile.strengths.join('; ')}.`,
    `Focus: ${args.successProfile.sponsorFocus.join('; ')}.`,
  ]
    .join(' ')
    .slice(0, 500);

  if (existing.documents.length > 0) {
    await gatewayCall('mongodb', 'update', {
      database: 'momentum',
      collection: HANDOFFS_COLLECTION,
      filter: { _id: handoffId },
      update: { $set: { ...handoff } },
    });
    const cy = handoffCypher(handoff);
    await gatewayCall('neo4j', 'cypher', { query: cy.cypher, params: cy.params });
  } else {
    await ensureHandoffCollection();
    await tripleStackWrite({
      id: handoffId,
      mongoCollection: HANDOFFS_COLLECTION,
      mongoDoc: { ...handoff },
      neo4j: handoffCypher(handoff),
      chroma: {
        collection: CHROMA_HANDOFFS,
        document: chromaDoc,
        metadata: {
          handoffId,
          baId: args.baId,
          sponsorBaId: args.sponsorBaId ?? '',
          tier: args.classification.tier,
          weightedTotal: args.classification.weightedTotal,
          kind: 'michael_founder_handoff',
        },
      },
    });
  }

  publishFounderHandoff(handoff);
  // eslint-disable-next-line no-console
  console.log(
    `[audit] michael_founder_handoff baId=${args.baId} tier=${handoff.tier} total=${handoff.weightedTotal} sms=${handoff.dispatch.sms} email=${handoff.dispatch.email} founders=${founderBaIds.length}`,
  );
  return handoff;
}

function handoffCypher(h: MichaelFounderHandoff): {
  cypher: string;
  params: Record<string, unknown>;
} {
  return {
    cypher:
      'MERGE (b:BA {baId: $baId}) ' +
      'MERGE (h:MichaelFounderHandoff {handoffId: $handoffId}) ' +
      'SET h.tier = $tier, h.weightedTotal = $weightedTotal, h.firedAt = $firedAt, ' +
      '    h.completedAt = $completedAt ' +
      'MERGE (b)-[:READY_FOR_HANDOFF]->(h)',
    params: {
      handoffId: h.handoffId,
      baId: h.baId,
      tier: h.tier,
      weightedTotal: h.weightedTotal,
      firedAt: h.firedAt,
      completedAt: h.completedAt,
    },
  };
}

/** Founder-only read: all handoffs, most recent first. Gated at the route by
 *  requireAdmin (ADMIN_BA_IDS = the founders). */
export async function listFounderHandoffs(limit = 100): Promise<MichaelFounderHandoff[]> {
  const result = await gatewayCall<{ documents: MichaelFounderHandoff[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: HANDOFFS_COLLECTION,
      filter: {},
      sort: { firedAt: -1 },
      limit,
    },
  );
  return result.documents.map(stripHandoff);
}

/** Read one handoff by baId (used to enrich the sponsor cockpit card). */
export async function getFounderHandoffByBaId(
  baId: string,
): Promise<MichaelFounderHandoff | null> {
  const result = await gatewayCall<{ documents: MichaelFounderHandoff[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: HANDOFFS_COLLECTION,
      filter: { baId },
      limit: 1,
    },
  );
  const doc = result.documents[0];
  return doc ? stripHandoff(doc) : null;
}

/** Drop the persisted `_id` mirror field if present. */
function stripHandoff(doc: MichaelFounderHandoff & { _id?: string }): MichaelFounderHandoff {
  return {
    handoffId: doc.handoffId,
    baId: doc.baId,
    baFirstName: doc.baFirstName,
    sponsorBaId: doc.sponsorBaId,
    tier: doc.tier,
    tierLabel: doc.tierLabel,
    weightedTotal: doc.weightedTotal,
    successProfile: doc.successProfile,
    completedAt: doc.completedAt,
    firedAt: doc.firedAt,
    founderBaIds: doc.founderBaIds,
    fastStartReady: doc.fastStartReady,
    dispatch: doc.dispatch,
  };
}
