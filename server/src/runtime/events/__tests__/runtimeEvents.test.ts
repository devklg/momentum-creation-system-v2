import { describe, expect, it } from 'vitest';
import type {
  McsAgentId,
  TmagId,
  McsCausationId,
  McsCorrelationId,
  McsIdempotencyKey,
  McsRequestId,
  McsRuntimeEventId,
  McsSessionId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  AGENT_EVENT_V1_SCHEMA_VERSION,
  RuntimeEventValidationError,
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  assertValidRuntimeEventEnvelope,
  createRuntimeEventEnvelope,
  validateRuntimeEventEnvelope,
  type RuntimeAgentEventEnvelope,
} from '../index.js';

const baseEvent: RuntimeAgentEventEnvelope = {
  eventId: 'evt_test_001' as McsRuntimeEventId,
  eventType: 'agent.session.created',
  schemaVersion: AGENT_EVENT_V1_SCHEMA_VERSION,
  tenantId: 'tenant_team_magnificent' as McsTenantId,
  teamId: 'team_magnificent' as McsTeamId,
  teamKey: TEAM_MAGNIFICENT_KEY,
  teamName: TEAM_MAGNIFICENT_NAME,
  tmagId: 'TMAG-TEST-001' as TmagId,
  agentKey: 'michael_magnificent',
  agentId: 'agent_instance_michael_default' as McsAgentId,
  sessionId: 'session_test_001' as McsSessionId,
  correlationId: 'corr_session_test_001' as McsCorrelationId,
  causationId: 'evt_parent_001' as McsCausationId,
  idempotencyKey: 'agent-session:session_test_001:created' as McsIdempotencyKey,
  source: 'agent_runtime',
  payload: {
    sessionId: 'session_test_001',
    agentKey: 'michael_magnificent',
    language: 'en',
    mode: 'browser_text',
    taskType: 'training_support',
  },
  occurredAt: '2026-06-28T10:00:00.000Z',
  recordedAt: '2026-06-28T10:00:01.000Z',
  metadata: {
    environment: 'test',
  },
  actor: {
    actorType: 'agent',
    actorId: 'agent_instance_michael_default',
    agentKey: 'michael_magnificent',
    agentId: 'agent_instance_michael_default' as McsAgentId,
  },
  provenance: {
    emittedBy: 'runtime_event_foundation_test',
    requestId: 'req_test_001' as McsRequestId,
    componentVersion: 's1.4',
  },
};

describe('runtime event foundation', () => {
  it('accepts a valid agent_event.v1 envelope with canonical timestamps and tracing fields', () => {
    const result = validateRuntimeEventEnvelope(baseEvent);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.event.schemaVersion).toBe('agent_event.v1');
      expect(result.event.occurredAt).toBe('2026-06-28T10:00:00.000Z');
      expect(result.event.recordedAt).toBe('2026-06-28T10:00:01.000Z');
      expect(result.event.correlationId).toBe('corr_session_test_001');
      expect(result.event.causationId).toBe('evt_parent_001');
      expect(result.event.idempotencyKey).toBe('agent-session:session_test_001:created');
      expect(result.event.source).toBe('agent_runtime');
      expect(result.event.actor.actorType).toBe('agent');
      expect(result.event.provenance.emittedBy).toBe('runtime_event_foundation_test');
    }
  });

  it('builds a valid envelope without persistence or outbox behavior', () => {
    const event = createRuntimeEventEnvelope(
      {
        ...baseEvent,
        eventId: undefined,
        occurredAt: undefined,
        recordedAt: undefined,
      },
      { now: () => new Date('2026-06-28T11:00:00.000Z') },
    );

    expect(event.eventId).toMatch(/^evt_/);
    expect(event.schemaVersion).toBe('agent_event.v1');
    expect(event.occurredAt).toBe('2026-06-28T11:00:00.000Z');
    expect(event.recordedAt).toBe('2026-06-28T11:00:00.000Z');
  });

  it('rejects createdAt because agent_event.v1 uses occurredAt and recordedAt', () => {
    const result = validateRuntimeEventEnvelope({
      ...baseEvent,
      createdAt: '2026-06-28T10:00:00.000Z',
    });

    expect(errorCodes(result)).toContain('created_at_forbidden');
  });

  it('rejects missing or invalid canonical timestamps', () => {
    const missing = validateRuntimeEventEnvelope({
      ...baseEvent,
      occurredAt: undefined,
    });
    const invalid = validateRuntimeEventEnvelope({
      ...baseEvent,
      recordedAt: '2026-06-28 10:00:01',
    });

    expect(errorCodes(missing)).toContain('required_timestamp');
    expect(errorCodes(invalid)).toContain('invalid_timestamp');
  });

  it('requires correlation and idempotency keys while allowing optional causation ids', () => {
    const rootEvent = validateRuntimeEventEnvelope({
      ...baseEvent,
      causationId: undefined,
    });
    const missingCorrelation = validateRuntimeEventEnvelope({
      ...baseEvent,
      correlationId: '',
    });
    const missingIdempotency = validateRuntimeEventEnvelope({
      ...baseEvent,
      idempotencyKey: '',
    });

    expect(rootEvent.ok).toBe(true);
    expect(errorCodes(missingCorrelation)).toContain('required');
    expect(errorCodes(missingIdempotency)).toContain('required');
  });

  it('enforces Team Magnificent scope when tmagId exists', () => {
    const result = validateRuntimeEventEnvelope({
      ...baseEvent,
      teamKey: undefined,
      teamName: undefined,
      teamId: undefined,
    });

    expect(errorCodes(result)).toEqual(
      expect.arrayContaining([
        'team_scope_required',
        'team_magnificent_scope_required',
      ]),
    );
  });

  it('keeps agentKey and agentId semantically distinct', () => {
    const badAgentKey = validateRuntimeEventEnvelope({
      ...baseEvent,
      agentKey: 'michael',
    });
    const semanticAgentId = validateRuntimeEventEnvelope({
      ...baseEvent,
      agentId: 'michael_magnificent',
      actor: {
        ...baseEvent.actor,
        agentId: 'michael_magnificent',
      },
    });

    expect(errorCodes(badAgentKey)).toContain('invalid_agent_key');
    expect(errorCodes(semanticAgentId)).toContain('agent_id_must_not_be_semantic_key');
  });

  it('requires actor, source, and provenance fields', () => {
    const missingActor = validateRuntimeEventEnvelope({
      ...baseEvent,
      actor: undefined,
    });
    const badSource = validateRuntimeEventEnvelope({
      ...baseEvent,
      source: 'unknown_runtime',
    });
    const missingProvenance = validateRuntimeEventEnvelope({
      ...baseEvent,
      provenance: undefined,
    });

    expect(errorCodes(missingActor)).toContain('actor_required');
    expect(errorCodes(badSource)).toContain('invalid_source');
    expect(errorCodes(missingProvenance)).toContain('provenance_required');
  });

  it('throws typed validation errors from the assertion helper', () => {
    expect(() =>
      assertValidRuntimeEventEnvelope({
        ...baseEvent,
        schemaVersion: 'agent_event.v0',
      }),
    ).toThrow(RuntimeEventValidationError);
  });
});

function errorCodes(result: ReturnType<typeof validateRuntimeEventEnvelope>): string[] {
  return result.ok ? [] : result.errors.map((error) => error.code);
}
