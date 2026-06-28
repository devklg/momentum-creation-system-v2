import type { RuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { resolveMichaelRuntimeTurnResponseFromFixture } from '../index.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  DeriveMichaelSelectionRequestFromRuntimeTurnInput,
  MichaelRuntimeResolutionResult,
  MichaelRuntimeResolutionTrace,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.20 — Michael resolution facade trace inertness / redaction. The trace is
// built explicitly from controlled, redacted metadata — it NEVER spreads the
// response or any raw upstream payload. It therefore contains only inert
// classification metadata: no raw Context Packet, no raw retrieval/store/
// GraphRAG/Gateway output, no generated text, no tokens / request IDs / session
// IDs / PII, and no automatic-action fields. persistence stays 'disabled' and
// agentResponseGenerated stays false. No route, no LLM, no persistence.
// ───────────────────────────────────────────────────────────────────────────

type TurnOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: RuntimeTaskType;
};

type DeriveArgs = Omit<DeriveMichaelSelectionRequestFromRuntimeTurnInput, 'runtimeTurn'>;

interface TraceCase {
  readonly name: string;
  readonly turn: TurnOverrides;
  readonly derive: DeriveArgs;
}

/** Representative cases across every family, EN + ES, plus collapse paths. */
const TRACE_CASES: readonly TraceCase[] = [
  { name: 'complete clear (en)', turn: { scenario: 'accepted_complete' }, derive: { intent: 'clear_training_support' } },
  { name: 'complete ambiguous (en)', turn: { scenario: 'accepted_complete' }, derive: { intent: 'ambiguous_training_support' } },
  { name: 'degraded (en)', turn: { scenario: 'accepted_degraded' }, derive: {} },
  { name: 'missing (en)', turn: { scenario: 'missing_context_manager' }, derive: {} },
  { name: 'failed (en)', turn: { scenario: 'failed_context' }, derive: {} },
  { name: 'rejected (en)', turn: { scenario: 'candidate_review_only_rejected' }, derive: {} },
  { name: 'complete clear (es)', turn: { scenario: 'accepted_complete' }, derive: { intent: 'clear_training_support', language: 'es' } },
  { name: 'degraded (es)', turn: { scenario: 'accepted_degraded' }, derive: { language: 'es' } },
  { name: 'failed (es)', turn: { scenario: 'failed_context' }, derive: { language: 'es' } },
  { name: 'wrong agent (steve_success)', turn: { agentKey: 'steve_success', scenario: 'accepted_complete' }, derive: {} },
  { name: 'wrong task (success_interview)', turn: { taskType: 'success_interview' }, derive: {} },
  { name: 'unsupported language (fr)', turn: { scenario: 'accepted_complete' }, derive: { language: 'fr' } },
];

const ALLOWED_TRACE_KEYS = new Set([
  'classification',
  'selectionRequest',
  'catalogKey',
  'responseType',
  'contextPacketStatus',
  'language',
  'persistence',
  'agentResponseGenerated',
]);

const ALLOWED_SELECTION_REQUEST_KEYS = new Set([
  'agentKey',
  'taskType',
  'language',
  'responseType',
  'scenarioFamily',
  'contextPacketStatus',
  'intent',
]);

const REQUIRED_SELECTION_REQUEST_KEYS = [
  'agentKey',
  'taskType',
  'language',
  'responseType',
  'scenarioFamily',
  'contextPacketStatus',
] as const;

// Forbidden key names — grouped by the redaction concern they guard.
const FORBIDDEN_CONTEXT_PACKET_KEYS = ['packet', 'contextPacket', 'retrievalAudit'];
const FORBIDDEN_RETRIEVAL_KEYS = ['retrieval', 'rawRetrieval', 'candidateKnowledge'];
const FORBIDDEN_STORE_KEYS = [
  'mongo',
  'neo4j',
  'chroma',
  'graphRag',
  'graphrag',
  'gateway',
  'rawStoreResults',
  'rawGraphRagResults',
  'rawGatewayFallbackResponse',
];
const FORBIDDEN_TEXT_KEYS = ['text', 'generatedText', 'message', 'prospectFacingMessage'];
const FORBIDDEN_IDENTITY_KEYS = [
  'token',
  'requestId',
  'sessionId',
  'correlationId',
  'turnId',
  'email',
  'phone',
  'prospect',
];
const FORBIDDEN_ACTION_KEYS = [
  'autoSend',
  'autoCall',
  'automaticSending',
  'automaticCalling',
  'nextStep',
];

async function buildTurn(turn: TurnOverrides = {}): Promise<RuntimeTurnFixtureHarnessResult> {
  return runRuntimeTurnFixtureScenario({
    scenario: turn.scenario ?? 'accepted_complete',
    agentKey: turn.agentKey ?? 'michael_magnificent',
    taskType: turn.taskType ?? 'training_support',
  });
}

async function resolveCase(testCase: TraceCase): Promise<MichaelRuntimeResolutionResult> {
  const runtimeTurn = await buildTurn(testCase.turn);
  return resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn, ...testCase.derive });
}

function expectTrace(result: MichaelRuntimeResolutionResult): MichaelRuntimeResolutionTrace {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('expected ok resolution with a trace');
  return result.trace;
}

/** Recursively collect every nested key name in `value` into `keys`. */
function collectKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
}

function allKeysOf(trace: MichaelRuntimeResolutionTrace): Set<string> {
  const keys = new Set<string>();
  collectKeys(trace, keys);
  return keys;
}

function expectNoForbiddenKeys(
  keys: Set<string>,
  forbidden: readonly string[],
  label: string,
): void {
  for (const name of forbidden) {
    expect(keys.has(name), `${label}: trace must not contain key "${name}"`).toBe(false);
  }
}

describe('S2.20 Michael resolution facade — trace inertness / redaction', () => {
  // ── 6. Trace top-level keys are a subset of the inert metadata allowlist. ──
  it('contains only inert metadata keys; persistence disabled; no response generated', async () => {
    for (const testCase of TRACE_CASES) {
      const trace = expectTrace(await resolveCase(testCase));

      for (const key of Object.keys(trace)) {
        expect(ALLOWED_TRACE_KEYS.has(key), `${testCase.name}: unexpected trace key "${key}"`).toBe(
          true,
        );
      }
      expect(trace.persistence).toBe('disabled');
      expect(trace.agentResponseGenerated).toBe(false);
    }
  });

  // ── 11 (positive). selectionRequest carries exactly its allowed keys. ──────
  it('trace.selectionRequest exposes only its allowed metadata keys', async () => {
    for (const testCase of TRACE_CASES) {
      const trace = expectTrace(await resolveCase(testCase));
      const keys = Object.keys(trace.selectionRequest);

      for (const key of keys) {
        expect(
          ALLOWED_SELECTION_REQUEST_KEYS.has(key),
          `${testCase.name}: unexpected selectionRequest key "${key}"`,
        ).toBe(true);
      }
      for (const required of REQUIRED_SELECTION_REQUEST_KEYS) {
        expect(keys, `${testCase.name}: missing selectionRequest key "${required}"`).toContain(
          required,
        );
      }
    }
  });

  // ── 7. No raw Context Packet anywhere in the serialized trace. ─────────────
  it('does not contain a raw Context Packet', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_CONTEXT_PACKET_KEYS, testCase.name);
    }
  });

  // ── 8. No raw retrieval output anywhere in the serialized trace. ───────────
  it('does not contain raw retrieval output', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_RETRIEVAL_KEYS, testCase.name);
    }
  });

  // ── 9. No raw store / GraphRAG / Gateway output anywhere in the trace. ─────
  it('does not contain raw store/GraphRAG/Gateway output', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_STORE_KEYS, testCase.name);
    }
  });

  // ── 10. No generated text fields anywhere in the serialized trace. ─────────
  it('does not contain generated text fields', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_TEXT_KEYS, testCase.name);
    }
  });

  // ── 11. No tokens / request IDs / session IDs / PII anywhere in the trace. ─
  it('does not contain tokens, request IDs, session IDs, or PII', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_IDENTITY_KEYS, testCase.name);
    }
  });

  // ── 12. No automatic-action fields anywhere in the serialized trace. ───────
  it('does not contain automatic action fields', async () => {
    for (const testCase of TRACE_CASES) {
      const keys = allKeysOf(expectTrace(await resolveCase(testCase)));
      expectNoForbiddenKeys(keys, FORBIDDEN_ACTION_KEYS, testCase.name);
    }
  });
});
