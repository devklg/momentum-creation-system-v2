/**
 * Agent Orchestration Layer.
 *
 * Coordinates existing agent surfaces without rewriting their logic:
 * - Steve remains the Discovery/Success Profile source of truth.
 * - Michael remains the Daily Success Coach conversation source of truth.
 * - Ivory remains the warm-market/generator source of truth.
 * - Steve is represented here only as a daily-action lane over existing
 *   cockpit projections; no outbound automation, scoring, or messaging.
 *
 * Recommendations are derived read models. Events are the durable audit trail
 * of what the BA did with a recommendation and are triple-stacked.
 */

import { randomUUID } from 'node:crypto';
import type {
  McsAgentEvent,
  McsAgentEventKind,
  McsAgentEventMetadataValue,
  McsAgentId,
  McsAgentRecommendation,
  McsAgentRecommendationKind,
  McsAgentRecommendationPriority,
  McsAgentRecommendationsResponse,
  McsAgentSubjectType,
  McsCreateAgentEventPayload,
  McsProspectFocusQueueItem,
} from '@momentum/shared';
import { tripleStackWrite } from '../../services/tripleStack.js';
import {
  getCockpitTodaysActions,
  getProspectMomentumViewer,
} from '../cockpit.js';
import { listIvoryNamesForBA } from '../ivory.js';
import { buildDiscoveryView } from '../steve-success-interview.js';

const EVENTS_COLLECTION = 'agent_events';
const EVENTS_CHROMA_COLLECTION = 'mcs_agent_events';

const AGENT_IDS: readonly McsAgentId[] = ['michael', 'ivory', 'steve', 'system'];
const EVENT_KINDS: readonly McsAgentEventKind[] = [
  'recommendation_viewed',
  'recommendation_actioned',
  'recommendation_dismissed',
  'agent_opened',
  'handoff_started',
  'handoff_completed',
];
const SUBJECT_TYPES: readonly McsAgentSubjectType[] = [
  'ba',
  'prospect',
  'ivory_name',
  'steve_discovery',
  'daily_actions',
  'system',
];

export class AgentEventValidationError extends Error {
  constructor(public readonly code: string) {
    super(`agent_event_validation: ${code}`);
    this.name = 'AgentEventValidationError';
  }
}

function isAgentId(value: unknown): value is McsAgentId {
  return typeof value === 'string' && AGENT_IDS.includes(value as McsAgentId);
}

function isEventKind(value: unknown): value is McsAgentEventKind {
  return typeof value === 'string' && EVENT_KINDS.includes(value as McsAgentEventKind);
}

function isSubjectType(value: unknown): value is McsAgentSubjectType {
  return typeof value === 'string' && SUBJECT_TYPES.includes(value as McsAgentSubjectType);
}

function sanitizeMetadata(
  input: Record<string, McsAgentEventMetadataValue> | undefined,
): Record<string, McsAgentEventMetadataValue> {
  if (!input) return {};
  const out: Record<string, McsAgentEventMetadataValue> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!key || key.length > 80) continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = typeof value === 'string' ? value.slice(0, 500) : value;
    }
  }
  return out;
}

function recommendation(args: {
  agentId: McsAgentId;
  kind: McsAgentRecommendationKind;
  priority: McsAgentRecommendationPriority;
  title: string;
  summary: string;
  reason: string;
  ctaLabel: string;
  route: string;
  subjectType: McsAgentSubjectType;
  subjectId: string | null;
  createdAt: string;
  expiresAt?: string | null;
}): McsAgentRecommendation {
  return {
    recommendationId: [
      args.agentId,
      args.kind,
      args.subjectType,
      args.subjectId ?? 'none',
    ].join(':'),
    agentId: args.agentId,
    kind: args.kind,
    priority: args.priority,
    title: args.title,
    summary: args.summary,
    reason: args.reason,
    ctaLabel: args.ctaLabel,
    route: args.route,
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    createdAt: args.createdAt,
    expiresAt: args.expiresAt ?? null,
  };
}

function clampPriority(input: number): McsAgentRecommendationPriority {
  if (input >= 5) return 5;
  if (input <= 1) return 1;
  return input as McsAgentRecommendationPriority;
}

function buildProspectRoute(item: McsProspectFocusQueueItem): string {
  return `/cockpit?prospectId=${encodeURIComponent(item.prospectId)}`;
}

export async function getAgentRecommendations(
  tmagId: string,
): Promise<McsAgentRecommendationsResponse> {
  const generatedAt = new Date().toISOString();
  const [pmv, todaysActions, ivoryNames, steveView] = await Promise.all([
    getProspectMomentumViewer(tmagId),
    getCockpitTodaysActions(tmagId),
    listIvoryNamesForBA(tmagId),
    buildDiscoveryView(tmagId),
  ]);

  const recommendations: McsAgentRecommendation[] = [];

  const steveArtifact = steveView?.artifact ?? null;
  if (steveArtifact) {
    recommendations.push(
      recommendation({
        agentId: 'steve',
        kind: 'review_steve_profile',
        priority: 3,
        title: 'Review your Steve Success Profile',
        summary: 'Steve has a completed discovery profile ready to read back.',
        reason: 'The orchestration layer found a completed Steve discovery.',
        ctaLabel: 'Open Steve',
        route: '/steve/discovery',
        subjectType: 'steve_discovery',
        subjectId: steveArtifact.callSid,
        createdAt: generatedAt,
      }),
    );
  }

  const dueActions = todaysActions.actions ?? [];
  if (dueActions.length > 0) {
    recommendations.push(
      recommendation({
        agentId: 'steve',
        kind: 'open_daily_actions',
        priority: 5,
        title: 'Work today\'s actions',
        summary: `${dueActions.length} action${dueActions.length === 1 ? '' : 's'} need attention.`,
        reason: 'Callbacks, due follow-ups, and expiring windows are already prioritized in the cockpit.',
        ctaLabel: 'Open cockpit',
        route: '/cockpit',
        subjectType: 'daily_actions',
        subjectId: tmagId,
        createdAt: generatedAt,
      }),
    );
  }

  const firstFocus = pmv.focusQueue[0];
  if (firstFocus) {
    recommendations.push(
      recommendation({
        agentId: firstFocus.source === 'ivory' ? 'ivory' : 'steve',
        kind: 'follow_up_prospect',
        priority: clampPriority(firstFocus.nextAction.priority),
        title: `Follow up with ${firstFocus.firstName}`,
        summary: firstFocus.nextAction.label,
        reason: firstFocus.nextAction.reason,
        ctaLabel: 'Open prospect',
        route: buildProspectRoute(firstFocus),
        subjectType: 'prospect',
        subjectId: firstFocus.prospectId,
        createdAt: generatedAt,
        expiresAt: firstFocus.nextAction.dueAt,
      }),
    );
  }

  const uninvitedIvoryName = ivoryNames.find((name) => name.status === 'new');
  if (uninvitedIvoryName) {
    recommendations.push(
      recommendation({
        agentId: 'ivory',
        kind: 'invite_from_ivory',
        priority: 4,
        title: `Invite ${uninvitedIvoryName.firstName}`,
        summary: 'Ivory has a warm-market name that has not been invited yet.',
        reason: 'The roster shows this name is still marked new.',
        ctaLabel: 'Open Ivory',
        route: '/ivory',
        subjectType: 'ivory_name',
        subjectId: uninvitedIvoryName.ivoryId,
        createdAt: generatedAt,
      }),
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      recommendation({
        agentId: 'steve',
        kind: 'keep_sharing',
        priority: 1,
        title: 'Create the next invitation',
        summary: 'No urgent follow-up is waiting right now.',
        reason: 'The cockpit focus queue and today\'s action card are clear.',
        ctaLabel: 'Open invitations',
        route: '/invitations',
        subjectType: 'system',
        subjectId: null,
        createdAt: generatedAt,
      }),
    );
  }

  recommendations.sort((a, b) => b.priority - a.priority);

  return {
    ok: true,
    generatedAt,
    recommendations: recommendations.slice(0, 5),
  };
}

export async function recordAgentEvent(
  tmagId: string,
  input: McsCreateAgentEventPayload,
): Promise<McsAgentEvent> {
  if (!isAgentId(input.agentId)) {
    throw new AgentEventValidationError('invalid_agent_id');
  }
  if (!isEventKind(input.kind)) {
    throw new AgentEventValidationError('invalid_event_kind');
  }

  const subjectType =
    input.subjectType && isSubjectType(input.subjectType)
      ? input.subjectType
      : 'system';
  const subjectId =
    typeof input.subjectId === 'string' && input.subjectId.trim()
      ? input.subjectId.trim().slice(0, 160)
      : null;
  const recommendationId =
    typeof input.recommendationId === 'string' && input.recommendationId.trim()
      ? input.recommendationId.trim().slice(0, 240)
      : null;
  const metadata = sanitizeMetadata(input.metadata);
  const now = new Date().toISOString();
  const eventId = `agent_event_${randomUUID()}`;

  const event: McsAgentEvent = {
    eventId,
    tmagId,
    agentId: input.agentId,
    kind: input.kind,
    recommendationId,
    subjectType,
    subjectId,
    metadata,
    createdAt: now,
  };

  await tripleStackWrite({
    id: eventId,
    mongoCollection: EVENTS_COLLECTION,
    mongoDoc: { ...event },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'CREATE (e:TmagAgentEvent {eventId: $id}) ' +
        'SET e.tmagId = $tmagId, ' +
        '    e.agentId = $agentId, ' +
        '    e.kind = $kind, ' +
        '    e.recommendationId = $recommendationId, ' +
        '    e.subjectType = $subjectType, ' +
        '    e.subjectId = $subjectId, ' +
        '    e.createdAt = $createdAt ' +
        'MERGE (b)-[:RECORDED_AGENT_EVENT]->(e)',
      params: {
        tmagId,
        agentId: event.agentId,
        kind: event.kind,
        recommendationId: event.recommendationId,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        createdAt: event.createdAt,
      },
    },
    chroma: {
      collection: EVENTS_CHROMA_COLLECTION,
      document:
        `Agent event ${event.kind} by BA ${tmagId}. Agent: ${event.agentId}. ` +
        `Subject: ${event.subjectType}${event.subjectId ? ` ${event.subjectId}` : ''}.`,
      metadata: {
        kind: event.kind,
        tmagId,
        agentId: event.agentId,
        recommendationId: event.recommendationId,
        subjectType: event.subjectType,
        subjectId: event.subjectId,
        createdAt: event.createdAt,
      },
    },
  });

  return event;
}
