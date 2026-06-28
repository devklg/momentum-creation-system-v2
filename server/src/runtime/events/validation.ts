import { randomUUID } from 'node:crypto';
import type {
  AgentKey,
  RuntimeEventId,
} from '@momentum/shared/runtime';
import type {
  CreateRuntimeEventEnvelopeInput,
  RuntimeAgentEventEnvelope,
  RuntimeEventActorType,
  RuntimeEventClock,
  RuntimeEventValidationIssue,
  RuntimeEventValidationResult,
} from './types.js';

export const AGENT_EVENT_V1_SCHEMA_VERSION = 'agent_event.v1' as const;
export const TEAM_MAGNIFICENT_KEY = 'team_magnificent' as const;
export const TEAM_MAGNIFICENT_NAME = 'Team Magnificent' as const;

const AGENT_KEYS = ['steve_success', 'michael_magnificent', 'ivory'] as const satisfies readonly AgentKey[];

const SEMANTIC_AGENT_ID_VALUES = new Set<string>([
  ...AGENT_KEYS,
  'steve',
  'michael',
]);

const ACTOR_TYPES = [
  'ba',
  'agent',
  'system',
  'admin',
  'subscriber',
] as const satisfies RuntimeEventActorType[];

const EVENT_SOURCES = [
  'browser_voice_runtime',
  'browser_text_runtime',
  'agent_runtime',
  'context_manager',
  'knowledge_core',
  'knowledge_ingestion',
  'learning_pipeline',
  'journal_runtime',
  'guided_action_runtime',
  'external_runtime',
  'implementation_test',
  'system',
] as const;

const EVENT_TYPE_PREFIXES = [
  'browser_voice.',
  'browser_text.',
  'agent.',
  'context.',
  'knowledge.',
  'knowledge_core.',
  'knowledge_ingestion.',
  'journal.',
  'guided_action.',
  'learning.',
  'external.',
  'system.',
] as const;

const defaultClock: RuntimeEventClock = {
  now: () => new Date(),
};

export function createRuntimeEventEnvelope<TPayload = Record<string, unknown>>(
  input: CreateRuntimeEventEnvelopeInput<TPayload>,
  clock: RuntimeEventClock = defaultClock,
): RuntimeAgentEventEnvelope<TPayload> {
  const now = clock.now().toISOString();
  const event: unknown = {
    ...input,
    eventId: input.eventId ?? (`evt_${randomUUID()}` as RuntimeEventId),
    schemaVersion: AGENT_EVENT_V1_SCHEMA_VERSION,
    occurredAt: input.occurredAt ?? now,
    recordedAt: input.recordedAt ?? now,
  };

  assertValidRuntimeEventEnvelope<TPayload>(event);
  return event;
}

export function assertValidRuntimeEventEnvelope<TPayload = Record<string, unknown>>(
  candidate: unknown,
): asserts candidate is RuntimeAgentEventEnvelope<TPayload> {
  const result = validateRuntimeEventEnvelope<TPayload>(candidate);
  if (!result.ok) {
    const detail = result.errors.map((error) => `${error.path}: ${error.message}`).join('; ');
    throw new RuntimeEventValidationError(`Invalid agent_event.v1 envelope: ${detail}`, result.errors);
  }
}

export function validateRuntimeEventEnvelope<TPayload = Record<string, unknown>>(
  candidate: unknown,
): RuntimeEventValidationResult<TPayload> {
  const errors: RuntimeEventValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: [
        {
          path: '$',
          code: 'invalid_envelope',
          message: 'Envelope must be an object.',
        },
      ],
    };
  }

  const event = candidate;

  if (Object.hasOwn(event, 'createdAt')) {
    errors.push(error('createdAt', 'created_at_forbidden', 'agent_event.v1 uses occurredAt and recordedAt, not createdAt.'));
  }

  requireString(event, 'eventId', errors);
  validateEventType(event.eventType, errors);
  validateSchemaVersion(event.schemaVersion, errors);
  requireString(event, 'tenantId', errors);
  validateTeamMagnificentScope(event, errors);
  validateAgentIdentity(event, errors);
  requireString(event, 'correlationId', errors);
  validateOptionalString(event, 'causationId', errors);
  requireString(event, 'idempotencyKey', errors);
  validateSource(event.source, errors);
  validatePayload(event.payload, errors);
  validateRequiredIsoTimestamp(event, 'occurredAt', errors);
  validateRequiredIsoTimestamp(event, 'recordedAt', errors);
  validateMetadata(event.metadata, errors);
  validateActor(event, errors);
  validateProvenance(event, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    event: event as unknown as RuntimeAgentEventEnvelope<TPayload>,
    errors: [],
  };
}

export class RuntimeEventValidationError extends Error {
  readonly errors: RuntimeEventValidationIssue[];

  constructor(message: string, errors: RuntimeEventValidationIssue[]) {
    super(message);
    this.name = 'RuntimeEventValidationError';
    this.errors = errors;
  }
}

function validateSchemaVersion(value: unknown, errors: RuntimeEventValidationIssue[]): void {
  if (value !== AGENT_EVENT_V1_SCHEMA_VERSION) {
    errors.push(error('schemaVersion', 'invalid_schema_version', 'schemaVersion must be agent_event.v1.'));
  }
}

function validateEventType(value: unknown, errors: RuntimeEventValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(error('eventType', 'required', 'eventType is required.'));
    return;
  }

  if (!EVENT_TYPE_PREFIXES.some((prefix) => value.startsWith(prefix))) {
    errors.push(error('eventType', 'invalid_event_type', 'eventType must use an approved runtime event namespace.'));
  }
}

function validateSource(value: unknown, errors: RuntimeEventValidationIssue[]): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(error('source', 'required', 'source is required.'));
    return;
  }

  if (!EVENT_SOURCES.includes(value as (typeof EVENT_SOURCES)[number])) {
    errors.push(error('source', 'invalid_source', 'source must be an approved AgentEventSource.'));
  }
}

function validateTeamMagnificentScope(
  event: Record<string, unknown>,
  errors: RuntimeEventValidationIssue[],
): void {
  const hasBaId = typeof event.baId === 'string' && event.baId.trim().length > 0;
  const hasTeamId = typeof event.teamId === 'string' && event.teamId.trim().length > 0;

  if (hasBaId && !hasTeamId) {
    errors.push(error('teamId', 'team_scope_required', 'teamId is required whenever baId is present.'));
  }

  if (hasBaId && event.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(error('teamKey', 'team_magnificent_scope_required', 'baId events must include teamKey team_magnificent.'));
  }

  if (hasBaId && event.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(error('teamName', 'team_magnificent_scope_required', 'baId events must include teamName Team Magnificent.'));
  }
}

function validateAgentIdentity(
  event: Record<string, unknown>,
  errors: RuntimeEventValidationIssue[],
): void {
  const agentKey = event.agentKey;
  const agentId = event.agentId;

  if (agentKey !== undefined && !AGENT_KEYS.includes(agentKey as AgentKey)) {
    errors.push(error('agentKey', 'invalid_agent_key', 'agentKey must be a semantic runtime registry identity.'));
  }

  if (agentId !== undefined) {
    if (typeof agentId !== 'string' || agentId.trim().length === 0) {
      errors.push(error('agentId', 'invalid_agent_id', 'agentId must be a non-empty configured runtime/database instance identity.'));
    } else if (SEMANTIC_AGENT_ID_VALUES.has(agentId)) {
      errors.push(error('agentId', 'agent_id_must_not_be_semantic_key', 'agentId must not be used as the semantic agent registry identity; use agentKey for that.'));
    }
  }

  if ((event.source === 'agent_runtime' || startsWith(event.eventType, 'agent.')) && agentKey === undefined) {
    errors.push(error('agentKey', 'agent_key_required', 'agent runtime events require agentKey.'));
  }
}

function validatePayload(value: unknown, errors: RuntimeEventValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(error('payload', 'invalid_payload', 'payload must be an object.'));
  }
}

function validateMetadata(value: unknown, errors: RuntimeEventValidationIssue[]): void {
  if (value !== undefined && !isRecord(value)) {
    errors.push(error('metadata', 'invalid_metadata', 'metadata must be an object when present.'));
  }
}

function validateActor(
  event: Record<string, unknown>,
  errors: RuntimeEventValidationIssue[],
): void {
  if (!isRecord(event.actor)) {
    errors.push(error('actor', 'actor_required', 'actor is required.'));
    return;
  }

  const actor = event.actor;

  if (!ACTOR_TYPES.includes(actor.actorType as RuntimeEventActorType)) {
    errors.push(error('actor.actorType', 'invalid_actor_type', 'actorType must be a known runtime actor type.'));
  }

  requireString(actor, 'actorId', errors, 'actor.actorId');

  if (actor.actorType === 'ba' && event.baId !== actor.baId) {
    errors.push(error('actor.baId', 'actor_scope_mismatch', 'BA actors must include the same baId as the event envelope.'));
  }

  if (actor.actorType === 'agent') {
    if (actor.agentKey !== event.agentKey) {
      errors.push(error('actor.agentKey', 'actor_agent_key_mismatch', 'Agent actors must include the same agentKey as the event envelope.'));
    }

    if (actor.agentId !== undefined && actor.agentId !== event.agentId) {
      errors.push(error('actor.agentId', 'actor_agent_id_mismatch', 'Agent actor agentId must match the envelope agentId when both are present.'));
    }
  }
}

function validateProvenance(
  event: Record<string, unknown>,
  errors: RuntimeEventValidationIssue[],
): void {
  if (!isRecord(event.provenance)) {
    errors.push(error('provenance', 'provenance_required', 'provenance is required.'));
    return;
  }

  requireString(event.provenance, 'emittedBy', errors, 'provenance.emittedBy');
  validateOptionalString(event.provenance, 'requestId', errors, 'provenance.requestId');
  validateOptionalString(event.provenance, 'componentVersion', errors, 'provenance.componentVersion');
  validateOptionalString(event.provenance, 'traceId', errors, 'provenance.traceId');
}

function validateRequiredIsoTimestamp(
  event: Record<string, unknown>,
  path: 'occurredAt' | 'recordedAt',
  errors: RuntimeEventValidationIssue[],
): void {
  if (typeof event[path] !== 'string' || event[path].trim().length === 0) {
    errors.push(error(path, 'required_timestamp', `${path} is required.`));
    return;
  }

  if (!isValidIsoDate(event[path])) {
    errors.push(error(path, 'invalid_timestamp', `${path} must be a valid ISO timestamp.`));
  }
}

function requireString(
  object: Record<string, unknown>,
  key: string,
  errors: RuntimeEventValidationIssue[],
  path = key,
): void {
  if (typeof object[key] !== 'string' || object[key].trim().length === 0) {
    errors.push(error(path, 'required', `${path} is required.`));
  }
}

function validateOptionalString(
  object: Record<string, unknown>,
  key: string,
  errors: RuntimeEventValidationIssue[],
  path = key,
): void {
  if (object[key] !== undefined && (typeof object[key] !== 'string' || object[key].trim().length === 0)) {
    errors.push(error(path, 'invalid_string', `${path} must be a non-empty string when present.`));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidIsoDate(value: string): boolean {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function startsWith(value: unknown, prefix: string): boolean {
  return typeof value === 'string' && value.startsWith(prefix);
}

function error(path: string, code: string, message: string): RuntimeEventValidationIssue {
  return { path, code, message };
}
