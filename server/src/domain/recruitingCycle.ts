/**
 * ACR-0011 — 5 Point Recruiting Cycle domain (LANE A · server).
 *
 * One `tmag_recruiting_cycles` record per launching BA, created on Steve
 * Discovery completion. This module owns:
 *
 *   1. CREATION  — createRecruitingCycle(): targets computed from enrollment,
 *      why_statement embedded to Chroma, Steve→Michael handoff event emitted.
 *      Triple-stacked (Mongo + Neo4j + Chroma) with a Mongo read-back, mirroring
 *      the threeWayCalls.ts / steve-success-interview.ts persistence pattern.
 *
 *   2. DERIVATION — the five-step / tranche / milestone state is DERIVED at read
 *      time from the existing canonical surfaces, never a parallel store
 *      (ACR §2.2, master-brief task 3):
 *        names        ← tmag_ivory_prospect_names   (per-BA count)
 *        invites      ← tmag_prospects              (records the BA sponsors)
 *        presentations← tmag_prospects PMV states   (video engagement reached)
 *        follow-ups   ← tmag_prospect_crm_followups (cleared = completed)
 *        enrollments  ← tmag_prospects state=enrolled
 *
 *   3. EVALUATION — evaluateCycleMilestones(): caches derived currentStep /
 *      lastActivityAt / five-point completion, and reconciles QBA / CORE 3 ONLY
 *      against Neo4j `(:BA)-[:ENROLLED {leg, at}]->(:BA)` edges (which are
 *      written ONLY by sponsor attestation). It NEVER self-declares QBA from
 *      derived enrollment counts. Milestone hits emit triple-stacked Michael
 *      celebration events.
 *
 *   4. ACTIVITY / STALL — recordCycleActivity() refreshes last_activity_at and
 *      clears a standing stall; flagCycleStall() is the FLAG-ONLY sweep write
 *      (stall_flagged_at + a Michael support event). Michael owns the response
 *      voice (why-replay) elsewhere — this module never coaches.
 *
 * LOCKED numbers (names target, tranche size, target/stall windows) come from
 * the shared module ONLY — never scattered literals here.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeKnowledge } from '../services/tieredWrite.js';
import { normalizeStevePrivacyState } from './stevePrivacy.js';
import {
  MCS_RECRUITING_STEPS,
  MCS_RECRUITING_STEP_LABELS,
  RECRUITING_CYCLE_FIVE_POINT_TARGET_HOURS,
  RECRUITING_CYCLE_HOUR_MS,
  RECRUITING_CYCLE_NAMES_TARGET,
  RECRUITING_CYCLE_QBA_TARGET_HOURS,
  RECRUITING_CYCLE_TRANCHE_COUNT,
  RECRUITING_CYCLE_TRANCHE_SIZE,
} from '@momentum/shared';
import type {
  McsIvoryName,
  McsProspectRecord,
  McsCrmFollowUpRecord,
  McsRecruitingAttestationLeg,
  McsRecruitingCycleDerived,
  McsRecruitingCycleMeResponse,
  McsRecruitingCycleRecord,
  McsRecruitingCycleStatus,
  McsRecruitingStep,
  McsRecruitingStepProgress,
  McsSteveSuccessProfile,
  McsTokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const CYCLES_COLLECTION = 'tmag_recruiting_cycles';
const CYCLES_CHROMA = 'mcs_recruiting_cycles';
const MICHAEL_EVENTS_COLLECTION = 'tmag_agent_michael_events';
const MICHAEL_EVENTS_CHROMA = 'mcs_agent_michael_events';
const NAMES_COLLECTION = 'tmag_ivory_prospect_names';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const STEVE_COLLECTION = 'tmag_steve_success_interview';
const MEMBERS_COLLECTION = 'team_magnificent_members';

const WHY_CAP = 1000;

/**
 * PMV states that count as "presentation engaged" (step 3). Any video-engagement
 * state, through completion and beyond, means the prospect was presented to.
 */
const PRESENTATION_STATES: ReadonlySet<McsTokenState> = new Set<McsTokenState>([
  'video_started',
  'video_quarter',
  'video_half',
  'video_three_quarter',
  'video_complete',
  'enrolled',
]);

export class RecruitingCycleError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message ?? code);
    this.name = 'RecruitingCycleError';
  }
}

function cycleIdFor(tmagId: string): string {
  return `rc_${tmagId}`;
}

function cap(s: string, max = WHY_CAP): string {
  return s.length > max ? s.slice(0, max) : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────────

export async function findCycleByTmagId(
  tmagId: string,
): Promise<McsRecruitingCycleRecord | null> {
  const result = await persistenceCall<{ documents: McsRecruitingCycleRecord[] }>(
    'mongodb',
    'query',
    { database: MONGO_DB, collection: CYCLES_COLLECTION, filter: { tmagId }, limit: 1 },
  );
  return result.documents?.[0] ?? null;
}

interface MemberRow {
  tmagId: string;
  sponsorTmagId?: string | null;
  createdAt?: string;
  firstName?: string;
}

async function getMember(tmagId: string): Promise<MemberRow | null> {
  const result = await persistenceCall<{ documents: MemberRow[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: MEMBERS_COLLECTION,
    filter: { tmagId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

/** The BA's own why_statement, verbatim from Steve's Success Profile. */
export async function getWhyStatement(tmagId: string): Promise<string | null> {
  const result = await persistenceCall<{
    documents: Array<{
      successProfile?: McsSteveSuccessProfile;
      privacy?: unknown;
    }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: STEVE_COLLECTION,
    filter: { tmagId },
    projection: {
      'successProfile.primaryWhy.statement': 1,
      privacy: 1,
    },
    limit: 1,
  });
  const discovery = result.documents?.[0];
  if (normalizeStevePrivacyState(discovery?.privacy).status === 'withdrawn') {
    return null;
  }
  const statement = discovery?.successProfile?.primaryWhy?.statement;
  return statement && statement.trim() ? statement : null;
}

async function getNamesForBA(tmagId: string): Promise<McsIvoryName[]> {
  const result = await persistenceCall<{ documents: McsIvoryName[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: NAMES_COLLECTION,
    filter: { tmagId },
    limit: 5000,
  });
  return result.documents ?? [];
}

async function getProspectsForBA(tmagId: string): Promise<McsProspectRecord[]> {
  const result = await persistenceCall<{ documents: McsProspectRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { sponsorTmagId: tmagId },
    limit: 5000,
  });
  return result.documents ?? [];
}

interface FollowUpRow extends McsCrmFollowUpRecord {
  updatedAt?: string | null;
}

async function getFollowUpsForBA(tmagId: string): Promise<FollowUpRow[]> {
  const result = await persistenceCall<{ documents: FollowUpRow[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: FOLLOWUPS_COLLECTION,
    filter: { sponsorTmagId: tmagId },
    limit: 5000,
  });
  return result.documents ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Derivation (pure)
// ─────────────────────────────────────────────────────────────────────────────

interface DerivedInputs {
  names: McsIvoryName[];
  prospects: McsProspectRecord[];
  followUps: FollowUpRow[];
  trancheSize: number;
}

/**
 * Pure derivation of the five-point / tranche state from the underlying surface
 * records. Step thresholds (ACR §2.1–2.2): step 1 clears at the first tranche
 * (coaching exit criterion), steps 2–5 clear on first qualifying activity.
 */
export function deriveCycleState(input: DerivedInputs): McsRecruitingCycleDerived {
  const trancheSize = input.trancheSize || RECRUITING_CYCLE_TRANCHE_SIZE;
  const namesCount = input.names.length;
  const invitesCount = input.prospects.length;
  const presentationsCount = input.prospects.filter((p) =>
    PRESENTATION_STATES.has(p.state),
  ).length;
  const enrollmentsCount = input.prospects.filter((p) => p.state === 'enrolled').length;
  const followUpsCount = input.followUps.filter((f) => f.clearedAt != null).length;

  const tranchesCompleted = Math.min(
    Math.floor(namesCount / trancheSize),
    RECRUITING_CYCLE_TRANCHE_COUNT,
  );

  const complete: Record<McsRecruitingStep, boolean> = {
    1: namesCount >= trancheSize,
    2: invitesCount >= 1,
    3: presentationsCount >= 1,
    4: followUpsCount >= 1,
    5: enrollmentsCount >= 1,
  };

  const steps: McsRecruitingStepProgress[] = MCS_RECRUITING_STEPS.map((step) => ({
    step,
    label: MCS_RECRUITING_STEP_LABELS[step],
    complete: complete[step],
  }));

  const firstIncomplete = MCS_RECRUITING_STEPS.find((step) => !complete[step]);
  const currentStep: McsRecruitingStep = firstIncomplete ?? 5;
  const fivePointComplete = MCS_RECRUITING_STEPS.every((step) => complete[step]);

  return {
    namesCount,
    namesTarget: RECRUITING_CYCLE_NAMES_TARGET,
    trancheSize,
    trancheCount: RECRUITING_CYCLE_TRANCHE_COUNT,
    tranchesCompleted,
    invitesCount,
    presentationsCount,
    followUpsCount,
    enrollmentsCount,
    currentStep,
    steps,
    fivePointComplete,
  };
}

/** Most recent qualifying-activity timestamp across the underlying surfaces. */
function deriveLastActivityAt(input: DerivedInputs, fallback: string): string {
  const stamps: string[] = [];
  for (const n of input.names) {
    stamps.push(n.updatedAt, n.lastTouchedAt ?? '', n.createdAt);
  }
  for (const p of input.prospects) {
    stamps.push(p.updatedAt, p.createdAt);
  }
  for (const f of input.followUps) {
    stamps.push(f.createdAt, f.clearedAt ?? '', f.updatedAt ?? '');
  }
  let max = fallback;
  for (const s of stamps) {
    if (s && s > max) max = s;
  }
  return max;
}

async function collectDerivedInputs(
  tmagId: string,
  trancheSize: number,
): Promise<DerivedInputs> {
  const [names, prospects, followUps] = await Promise.all([
    getNamesForBA(tmagId),
    getProspectsForBA(tmagId),
    getFollowUpsForBA(tmagId),
  ]);
  return { names, prospects, followUps, trancheSize };
}

// ─────────────────────────────────────────────────────────────────────────────
// Michael event emission (triple-stacked). Handoff / celebration / support.
// ─────────────────────────────────────────────────────────────────────────────

export interface MichaelEventInput {
  tmagId: string;
  kind: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function emitMichaelEvent(input: MichaelEventInput): Promise<string> {
  const eventId = `rc_michael_${randomUUID()}`;
  const createdAt = new Date().toISOString();
  const doc = {
    eventId,
    tmagId: input.tmagId,
    agentId: 'michael' as const,
    kind: input.kind,
    summary: input.summary,
    createdAt,
    metadata: input.metadata ?? {},
  };
  await writeKnowledge({
    id: eventId,
    mongoCollection: MICHAEL_EVENTS_COLLECTION,
    mongoDoc: { ...doc },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'CREATE (e:TmagAgentMichaelEvent {eventId: $id}) ' +
        'SET e.tmagId = $tmagId, e.agentId = $agentId, e.kind = $kind, e.createdAt = $createdAt ' +
        'MERGE (b)-[:RECEIVED_MICHAEL_EVENT]->(e)',
      params: {
        tmagId: input.tmagId,
        agentId: 'michael',
        kind: input.kind,
        createdAt,
      },
    },
    chroma: {
      collection: MICHAEL_EVENTS_CHROMA,
      document: `${input.kind}: ${input.summary} (BA ${input.tmagId}) at ${createdAt}`,
      metadata: {
        kind: input.kind,
        tmagId: input.tmagId,
        agentId: 'michael',
        createdAt,
      },
    },
  });
  return eventId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Creation
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateRecruitingCycleInput {
  tmagId: string;
  /** Enrollment anchor for the +48h / +72h targets. Defaults to the member's createdAt. */
  enrolledAt?: string;
  /** BA's why_statement, verbatim from Steve's Success Profile (for why-replay). */
  whyStatement?: string | null;
  /** Emit the Steve→Michael handoff event on fresh creation. Default true. */
  emitHandoff?: boolean;
}

/**
 * Create the BA's recruiting cycle. Idempotent on tmagId — a re-run (e.g. a Steve
 * re-ingest) returns the existing cycle and does NOT re-anchor targets. Triple-
 * stacked with a Mongo read-back; the why_statement is embedded to Chroma for
 * Michael's why-replay retrieval, and a Steve→Michael handoff event is emitted.
 */
export async function createRecruitingCycle(
  input: CreateRecruitingCycleInput,
): Promise<McsRecruitingCycleRecord> {
  const existing = await findCycleByTmagId(input.tmagId);
  if (existing) return existing;

  const member = await getMember(input.tmagId);
  if (!member) {
    throw new RecruitingCycleError('NO_BA', `No BA record for tmagId=${input.tmagId}.`);
  }

  const now = new Date().toISOString();
  const enrolledAt = input.enrolledAt ?? member.createdAt ?? now;
  const enrolledMs = Date.parse(enrolledAt);
  const anchorMs = Number.isFinite(enrolledMs) ? enrolledMs : Date.parse(now);
  const fivePointTargetAt = new Date(
    anchorMs + RECRUITING_CYCLE_FIVE_POINT_TARGET_HOURS * RECRUITING_CYCLE_HOUR_MS,
  ).toISOString();
  const qbaTargetAt = new Date(
    anchorMs + RECRUITING_CYCLE_QBA_TARGET_HOURS * RECRUITING_CYCLE_HOUR_MS,
  ).toISOString();

  const why = input.whyStatement ?? (await getWhyStatement(input.tmagId));
  const id = cycleIdFor(input.tmagId);

  const record: McsRecruitingCycleRecord = {
    tmagId: input.tmagId,
    enrolledAt,
    fivePointTargetAt,
    fivePointCompletedAt: null,
    qbaTargetAt,
    qbaAchievedAt: null,
    qbaLeftLegTmagId: null,
    qbaRightLegTmagId: null,
    qbaAttestedBy: null,
    core3AchievedAt: null,
    core3TmagId: null,
    namesTarget: RECRUITING_CYCLE_NAMES_TARGET,
    trancheSize: RECRUITING_CYCLE_TRANCHE_SIZE,
    currentStep: 1,
    lastActivityAt: enrolledAt,
    stallFlaggedAt: null,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const whyDoc = why
    ? `Recruiting cycle for BA ${input.tmagId}. Why: ${cap(why)}`
    : `Recruiting cycle for BA ${input.tmagId}. Why not yet captured.`;

  await writeKnowledge({
    id,
    mongoCollection: CYCLES_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'MERGE (c:TmagRecruitingCycle {tmagId: $tmagId}) ' +
        'SET c.enrolledAt = $enrolledAt, c.fivePointTargetAt = $fivePointTargetAt, ' +
        '    c.qbaTargetAt = $qbaTargetAt, c.currentStep = $currentStep, ' +
        '    c.status = $status, c.lastActivityAt = $lastActivityAt, c.updatedAt = $updatedAt ' +
        'MERGE (b)-[:HAS_RECRUITING_CYCLE]->(c)',
      params: {
        tmagId: record.tmagId,
        enrolledAt: record.enrolledAt,
        fivePointTargetAt: record.fivePointTargetAt,
        qbaTargetAt: record.qbaTargetAt,
        currentStep: record.currentStep,
        status: record.status,
        lastActivityAt: record.lastActivityAt,
        updatedAt: record.updatedAt,
      },
    },
    chroma: {
      collection: CYCLES_CHROMA,
      document: whyDoc,
      metadata: {
        kind: 'recruiting_cycle_created',
        cycleId: id,
        tmagId: record.tmagId,
        enrolledAt: record.enrolledAt,
        whyStatement: why ? cap(why, 500) : '',
      },
    },
  });

  // Read-back verification across the Mongo leg (VERIFY BEFORE DONE).
  const readback = await findCycleByTmagId(input.tmagId);
  if (!readback || readback.tmagId !== input.tmagId) {
    throw new RecruitingCycleError(
      'READBACK_FAILED',
      `Recruiting cycle for tmagId=${input.tmagId} did not read back after write.`,
    );
  }

  // Steve → Michael handoff (initialization only; Steve never coaches).
  if (input.emitHandoff !== false) {
    await emitMichaelEvent({
      tmagId: input.tmagId,
      kind: 'recruiting_cycle_initialized',
      summary:
        `Steve initialized the 5 Point recruiting cycle. Five-point target ${fivePointTargetAt}, ` +
        `QBA target ${qbaTargetAt}. ${why ? 'Why captured for why-replay.' : 'Why pending.'}`,
      metadata: {
        cycleId: id,
        fivePointTargetAt,
        qbaTargetAt,
        hasWhy: Boolean(why),
      },
    });
  }

  return readback;
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity / stall writes
// ─────────────────────────────────────────────────────────────────────────────

async function patchCycle(
  tmagId: string,
  patch: Partial<McsRecruitingCycleRecord>,
  neo4jSet: string,
  neo4jParams: Record<string, unknown>,
): Promise<void> {
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CYCLES_COLLECTION,
    filter: { tmagId },
    update: { $set: patch },
  });
  await persistenceCall('neo4j', 'cypher', {
    query: `MATCH (c:TmagRecruitingCycle {tmagId: $tmagId}) SET ${neo4jSet}`,
    params: { tmagId, ...neo4jParams },
  });
}

/**
 * Refresh last_activity_at on qualifying activity and clear any standing stall
 * flag (returns a stalled cycle to active). Idempotent; no-op if no cycle.
 */
export async function recordCycleActivity(
  tmagId: string,
  at?: string,
): Promise<McsRecruitingCycleRecord | null> {
  const cycle = await findCycleByTmagId(tmagId);
  if (!cycle) return null;
  const now = at ?? new Date().toISOString();
  const nextStatus: McsRecruitingCycleStatus =
    cycle.status === 'completed' ? 'completed' : 'active';
  const patch: Partial<McsRecruitingCycleRecord> = {
    lastActivityAt: now,
    stallFlaggedAt: null,
    status: nextStatus,
    updatedAt: now,
  };
  await patchCycle(
    tmagId,
    patch,
    'c.lastActivityAt = $now, c.stallFlaggedAt = null, c.status = $status, c.updatedAt = $now',
    { now, status: nextStatus },
  );
  return { ...cycle, ...patch };
}

/**
 * FLAG-ONLY stall write (ACR §2.5). Sets stall_flagged_at + status=stalled and
 * emits a Michael support event. Michael owns the response voice (why-replay)
 * elsewhere; this never coaches and never messages the BA. Idempotent — a cycle
 * already flagged is not re-flagged.
 */
export async function flagCycleStall(
  tmagId: string,
  at?: string,
): Promise<McsRecruitingCycleRecord | null> {
  const cycle = await findCycleByTmagId(tmagId);
  if (!cycle) return null;
  if (cycle.stallFlaggedAt) return cycle;

  const now = at ?? new Date().toISOString();
  const patch: Partial<McsRecruitingCycleRecord> = {
    stallFlaggedAt: now,
    status: 'stalled',
    updatedAt: now,
  };
  await patchCycle(
    tmagId,
    patch,
    'c.stallFlaggedAt = $now, c.status = $status, c.updatedAt = $now',
    { now, status: 'stalled' },
  );

  await emitMichaelEvent({
    tmagId,
    kind: 'recruiting_cycle_stall_flagged',
    summary:
      'Momentum slowed — support flagged. Michael opens with the BA\'s own why (why-replay) ' +
      'before coaching the earliest incomplete step. No shame, no urgency pressure.',
    metadata: { cycleId: cycleIdFor(tmagId), flaggedAt: now, currentStep: cycle.currentStep },
  });

  return { ...cycle, ...patch };
}

// ─────────────────────────────────────────────────────────────────────────────
// Neo4j enrollment-edge validation (the QBA / CORE 3 source of truth)
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrollmentEdge {
  leg: McsRecruitingAttestationLeg;
  enrolleeTmagId: string;
  at: string;
}

/**
 * Read the `(:BA)-[:ENROLLED {leg, at}]->(:BA)` edges for a launching BA. These
 * are written ONLY by sponsor attestation and are the verifiable genealogy
 * source the evaluator validates QBA / CORE 3 against — never derived counts.
 */
export async function readEnrollmentEdges(tmagId: string): Promise<EnrollmentEdge[]> {
  const result = await persistenceCall<{
    records?: Array<{ leg?: string; enrolleeTmagId?: string; at?: string }>;
  }>('neo4j', 'cypher', {
    query:
      'MATCH (b:TeamMagnificentMember {tmagId: $tmagId})-[e:ENROLLED]->(x:TeamMagnificentMember) ' +
      'RETURN e.leg AS leg, x.tmagId AS enrolleeTmagId, e.at AS at',
    params: { tmagId },
  });
  const rows = result.records ?? [];
  const edges: EnrollmentEdge[] = [];
  for (const r of rows) {
    if (r.leg === 'left' || r.leg === 'right' || r.leg === 'core3') {
      edges.push({
        leg: r.leg,
        enrolleeTmagId: typeof r.enrolleeTmagId === 'string' ? r.enrolleeTmagId : '',
        at: typeof r.at === 'string' ? r.at : '',
      });
    }
  }
  return edges;
}

// ─────────────────────────────────────────────────────────────────────────────
// Milestone evaluator
// ─────────────────────────────────────────────────────────────────────────────

export interface EvaluateResult {
  cycle: McsRecruitingCycleRecord;
  derived: McsRecruitingCycleDerived;
  milestonesReached: string[];
}

/**
 * Evaluate + reconcile a cycle. Caches derived currentStep / lastActivityAt and
 * the five-point completion; reconciles QBA / CORE 3 ONLY from Neo4j ENROLLED
 * edges (attestation-written) — it NEVER self-declares QBA from enrollment
 * counts. Milestone transitions emit triple-stacked Michael celebration events.
 */
export async function evaluateCycleMilestones(
  tmagId: string,
): Promise<EvaluateResult | null> {
  const cycle = await findCycleByTmagId(tmagId);
  if (!cycle) return null;

  const inputs = await collectDerivedInputs(tmagId, cycle.trancheSize);
  const derived = deriveCycleState(inputs);
  const lastActivityAt = deriveLastActivityAt(inputs, cycle.lastActivityAt);

  const now = new Date().toISOString();
  const patch: Partial<McsRecruitingCycleRecord> = {};
  const milestonesReached: string[] = [];

  if (derived.currentStep !== cycle.currentStep) patch.currentStep = derived.currentStep;
  if (lastActivityAt > cycle.lastActivityAt) patch.lastActivityAt = lastActivityAt;

  // Five-point completion (derived — the ONLY milestone the evaluator may set).
  if (derived.fivePointComplete && !cycle.fivePointCompletedAt) {
    patch.fivePointCompletedAt = now;
    milestonesReached.push('five_point_cycle_completed');
  }

  // QBA / CORE 3 — reconcile from Neo4j ENROLLED edges ONLY. No edge ⇒ no
  // milestone, even if derived enrollmentsCount is high (refuses self-declared QBA).
  const edges = await readEnrollmentEdges(tmagId);
  const left = edges.find((e) => e.leg === 'left');
  const right = edges.find((e) => e.leg === 'right');
  const core3 = edges.find((e) => e.leg === 'core3');

  if (left && right && !cycle.qbaAchievedAt) {
    patch.qbaAchievedAt = now;
    patch.qbaLeftLegTmagId = cycle.qbaLeftLegTmagId ?? left.enrolleeTmagId;
    patch.qbaRightLegTmagId = cycle.qbaRightLegTmagId ?? right.enrolleeTmagId;
    milestonesReached.push('qba_achieved');
  }
  if (core3 && !cycle.core3AchievedAt) {
    patch.core3AchievedAt = now;
    patch.core3TmagId = cycle.core3TmagId ?? core3.enrolleeTmagId;
    milestonesReached.push('core3_achieved');
  }

  const qbaAchieved = cycle.qbaAchievedAt ?? patch.qbaAchievedAt ?? null;
  if (qbaAchieved && cycle.status !== 'completed') patch.status = 'completed';

  let updated = cycle;
  if (Object.keys(patch).length > 0) {
    patch.updatedAt = now;
    await patchCycle(
      tmagId,
      patch,
      'c.currentStep = coalesce($currentStep, c.currentStep), ' +
        'c.lastActivityAt = coalesce($lastActivityAt, c.lastActivityAt), ' +
        'c.status = coalesce($status, c.status), ' +
        'c.fivePointCompletedAt = coalesce($fivePointCompletedAt, c.fivePointCompletedAt), ' +
        'c.qbaAchievedAt = coalesce($qbaAchievedAt, c.qbaAchievedAt), ' +
        'c.core3AchievedAt = coalesce($core3AchievedAt, c.core3AchievedAt), ' +
        'c.updatedAt = $updatedAt',
      {
        currentStep: patch.currentStep ?? null,
        lastActivityAt: patch.lastActivityAt ?? null,
        status: patch.status ?? null,
        fivePointCompletedAt: patch.fivePointCompletedAt ?? null,
        qbaAchievedAt: patch.qbaAchievedAt ?? null,
        core3AchievedAt: patch.core3AchievedAt ?? null,
        updatedAt: now,
      },
    );
    updated = { ...cycle, ...patch };
  }

  for (const milestone of milestonesReached) {
    await emitMichaelEvent({
      tmagId,
      kind: `recruiting_milestone_${milestone}`,
      summary: celebrationCopy(milestone),
      metadata: { cycleId: cycleIdFor(tmagId), milestone, reachedAt: now },
    });
  }

  return { cycle: updated, derived, milestonesReached };
}

function celebrationCopy(milestone: string): string {
  switch (milestone) {
    case 'five_point_cycle_completed':
      return 'All five recruiting steps complete — the launch cycle is through its full loop. Celebrate the momentum.';
    case 'qba_achieved':
      return 'QBA achieved — one left leg and one right leg attested. A real milestone; celebrate it.';
    case 'core3_achieved':
      return 'CORE 3 reached — the third enrollment is in. Momentum is compounding.';
    default:
      return `Milestone reached: ${milestone}.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read model for GET /api/recruiting-cycle/me
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the launching BA's own cycle view. Lazily creates the cycle if Steve is
 * complete but the initialization hook never landed one (self-heal), then runs
 * the evaluator so currentStep / lastActivityAt reflect live derived state.
 */
export async function buildRecruitingCycleMe(
  tmagId: string,
): Promise<McsRecruitingCycleMeResponse> {
  let cycle = await findCycleByTmagId(tmagId);
  if (!cycle) {
    // Self-heal only when a Success Profile exists (Steve complete).
    const why = await getWhyStatement(tmagId);
    const member = await getMember(tmagId);
    if (why !== null || member) {
      const hasSteve = await hasSuccessProfile(tmagId);
      if (hasSteve) {
        cycle = await createRecruitingCycle({ tmagId, whyStatement: why });
      }
    }
  }

  if (!cycle) {
    return { ok: true, cycle: null, derived: null, why: null };
  }

  const evaluated = await evaluateCycleMilestones(tmagId);
  const why = await getWhyStatement(tmagId);
  return {
    ok: true,
    cycle: evaluated?.cycle ?? cycle,
    derived: evaluated?.derived ?? null,
    why,
  };
}

async function hasSuccessProfile(tmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ count?: number; documents?: unknown[] }>(
    'mongodb',
    'query',
    { database: MONGO_DB, collection: STEVE_COLLECTION, filter: { tmagId }, limit: 1 },
  );
  if (typeof result.count === 'number') return result.count > 0;
  return (result.documents?.length ?? 0) > 0;
}
