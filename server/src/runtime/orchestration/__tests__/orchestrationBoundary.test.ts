import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type {
  McsAgentId,
  TmagId,
  McsContextPacketId,
  McsContextRequestId,
  McsCorrelationId,
  McsSessionId,
  McsRuntimeTurnId,
  McsSourceId,
  McsKnowledgeId,
  McsTeamId,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  buildContextPacket,
  type ContextPacketBuildInput,
} from '../../context/contextManager.js';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
  assertValidRuntimeEventEnvelope,
} from '../../events/index.js';
import {
  AGENT_ORCHESTRATION_REGISTRY,
  ORCHESTRATION_AGENT_KEYS,
  agentOrchestrationBoundary,
  createAgentSession,
  createEventCapture,
  planAgentTurn,
} from '../index.js';
import type { OrchestrationSessionIdentity } from '../index.js';

const orchestrationRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(orchestrationRoot, '../../../..');

function normalizePath(path: string): string {
  return path.split(sep).join('/');
}

function collectOrchestrationFiles(): Array<{ relativePath: string; text: string }> {
  const files: Array<{ relativePath: string; text: string }> = [];

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      if (entry === '__tests__') continue;
      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!entry.endsWith('.ts')) continue;
      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(orchestrationRoot);
  return files;
}

function collectTextFiles(relativeRoot: string): Array<{ relativePath: string; text: string }> {
  const root = resolve(repoRoot, relativeRoot);
  const files: Array<{ relativePath: string; text: string }> = [];
  if (!existsSync(root)) return files;

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const absolutePath = resolve(current, entry);
      const stats = statSync(absolutePath);
      if (stats.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx|css|html)$/.test(entry)) continue;
      files.push({
        relativePath: normalizePath(relative(repoRoot, absolutePath)),
        text: readFileSync(absolutePath, 'utf8'),
      });
    }
  }

  walk(root);
  return files;
}

function matchingLines(pattern: RegExp): string[] {
  return collectOrchestrationFiles().flatMap((file) =>
    file.text
      .split(/\r?\n/)
      .map((line, index) => ({ line, lineNumber: index + 1 }))
      .filter(({ line }) => pattern.test(line))
      .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
  );
}

function identity(): OrchestrationSessionIdentity {
  return {
    scope: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-ORCH-001' as TmagId,
    },
    sessionId: 'session_orch_001' as McsSessionId,
    agentKey: 'michael_magnificent',
    mode: 'browser_text',
    language: 'en',
    correlationId: 'corr_orch_001' as McsCorrelationId,
  };
}

function validInput(): ContextPacketBuildInput {
  return {
    packetId: 'ctx_orch_001' as McsContextPacketId,
    requestId: 'ctx_orch_req_001' as McsContextRequestId,
    tenant: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      tenantName: 'Team Magnificent Tenant',
      brandName: 'Team Magnificent',
      environment: 'development',
    },
    team: {
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
    },
    ba: {
      tenantId: 'tenant_team_magnificent' as McsTenantId,
      teamId: 'team_magnificent' as McsTeamId,
      teamKey: TEAM_MAGNIFICENT_KEY,
      teamName: TEAM_MAGNIFICENT_NAME,
      tmagId: 'TMAG-ORCH-001' as TmagId,
      journalEnabled: true,
      languagePreference: 'en',
      permissions: {
        canUsePrivateJournal: true,
        canSelectJournalForReview: false,
        canCreateKnowledgeCandidate: false,
        canAccessRelationshipContext: false,
        canUseBrowserVoice: true,
        canUseBrowserText: true,
      },
    },
    session: {
      sessionId: 'session_orch_001' as McsSessionId,
      mode: 'browser_text',
      status: 'active',
      taskType: 'training_support',
      startedAt: '2026-06-28T11:59:00.000Z',
    },
    agentKey: 'michael_magnificent',
    agentId: 'agent_instance_michael_default' as McsAgentId,
    objective: 'prepare a training support turn',
    language: {
      primary: 'en',
      userPreference: 'en',
      translationAllowed: false,
      translationStatus: 'same_language',
      machineTranslationUsed: false,
      humanReviewed: true,
    },
    knowledgeReferences: [
      {
        sourceId: 'knowledge_approved_001' as McsSourceId,
        knowledgeId: 'knowledge_approved_001' as McsKnowledgeId,
        kind: 'approved_knowledge',
        title: 'Approved training rule',
        summary: 'Approved guidance for the training support turn.',
        status: 'approved',
        score: 0.97,
      },
    ],
    provenance: {
      assembledBy: 'context_manager',
      requestId: 'ctx_orch_req_001' as McsContextRequestId,
      componentVersion: 's1.5',
      traceId: 'trace_orch_001',
    },
    createdAt: '2026-06-28T12:00:02.000Z',
  };
}

describe('S2.1 orchestration import boundary', () => {
  it('does not import stores, direct adapters, GraphRAG, or Gateway fallback clients', () => {
    const forbidden =
      /\bfrom\s+['"](?:mongoose|mongodb|neo4j-driver|chromadb|[^'"]*\/services\/gateway\.js|[^'"]*\/services\/persistence\/[^'"]*|[^'"]*graph-?rag[^'"]*|[^'"]*retrieval[^'"]*)['"]|new\s+MongoClient\b|mongoose\.connect\b|neo4j\.driver\b|ChromaClient\b|gatewayCall\b|tripleStackWrite\b|rawRetrieval\b|retrievalHelper\b|directRetrieval\b/i;
    const matches = matchingLines(forbidden);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('never assembles Context Packets (Context Manager remains the only assembler)', () => {
    const matches = matchingLines(/\bbuildContextPacket\b|\bprepareContextPacketFoundation\b/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('does not mount routes or reference an /api/runtime surface', () => {
    const matches = matchingLines(/app\.use\(|express\(|\/api\/runtime/);
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('confirms /api/runtime remains unmounted in the server entrypoint', () => {
    const serverIndex = readFileSync(resolve(repoRoot, 'server/src/index.ts'), 'utf8');
    expect(serverIndex).not.toMatch(/\/api\/runtime/);
  });

  it('confirms .com has no S2 agent runtime request wiring', () => {
    const matches = collectTextFiles('apps/com/src').flatMap((file) =>
      file.text
        .split(/\r?\n/)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) =>
          /agent_runtime|runtime\/orchestration|requestContextPacket|ContextPacket|\/api\/runtime|steve_success|michael_magnificent|ivory|context\.packet/i.test(
            line,
          ),
        )
        .map(({ line, lineNumber }) => `${file.relativePath}:${lineNumber}: ${line.trim()}`),
    );
    expect(matches, matches.join('\n')).toEqual([]);
  });

  it('confirms the Gateway fallback client remains present and unchanged by orchestration', () => {
    const gatewayClient = readFileSync(resolve(repoRoot, 'server/src/services/gateway.ts'), 'utf8');
    expect(gatewayClient).toContain('export async function gatewayCall');
    expect(gatewayClient).not.toContain('/execute');
    expect(gatewayClient).not.toContain('GATEWAY_URL');
  });

  it('keeps the orchestration boundary descriptor inert', () => {
    expect(agentOrchestrationBoundary.status).toBe('skeleton_only');
    expect(agentOrchestrationBoundary.activated).toBe(false);
    expect(agentOrchestrationBoundary.apiMounted).toBe(false);
    expect(agentOrchestrationBoundary.behaviorEnabled).toBe(false);
    expect(agentOrchestrationBoundary.agentBehaviorImplemented).toBe(false);
    expect(agentOrchestrationBoundary.eventPersistence).toBe('disabled');
    expect(agentOrchestrationBoundary.contextPacketAssembly).toBe('context_manager_only');
    expect(agentOrchestrationBoundary.persistenceAccess).toBe('service_boundary_only');
  });

  it('registers all three agents with behavior not implemented', () => {
    expect(ORCHESTRATION_AGENT_KEYS).toEqual([
      'steve_success',
      'michael_magnificent',
      'ivory',
    ]);
    for (const key of ORCHESTRATION_AGENT_KEYS) {
      expect(AGENT_ORCHESTRATION_REGISTRY[key].behaviorImplemented).toBe(false);
      expect(AGENT_ORCHESTRATION_REGISTRY[key].requiresContextPacket).toBe(true);
    }
  });
});

describe('S2.1 non-persistent runtime event capture', () => {
  it('exposes an in-memory capture buffer that never persists', () => {
    const capture = createEventCapture();
    expect(capture.persisted).toBe(false);
    expect(capture.list()).toEqual([]);
  });

  it('captures valid, non-persistent events when creating a session', () => {
    const result = createAgentSession({ ...identity() });
    expect(result.state.status).toBe('created');
    expect(result.events.length).toBeGreaterThan(0);
    for (const envelope of result.events) {
      expect(() => assertValidRuntimeEventEnvelope(envelope)).not.toThrow();
      expect(Object.hasOwn(envelope, 'createdAt')).toBe(false);
    }
  });

  it('plans a turn without implementing agent behavior and captures valid events', () => {
    const packet = buildContextPacket(validInput());
    const plan = planAgentTurn({
      identity: identity(),
      turnId: 'turn_orch_001' as McsRuntimeTurnId,
      packet,
    });

    expect(plan.behavior).toBe('not_implemented');
    expect(plan.decision).toBe('proceed');
    expect(plan.events.length).toBeGreaterThan(0);
    for (const envelope of plan.events) {
      expect(() => assertValidRuntimeEventEnvelope(envelope)).not.toThrow();
      expect(envelope.source).toBe('agent_runtime');
    }
  });

  it('captures rejection and guardrail events for an invalid packet without throwing', () => {
    const plan = planAgentTurn({
      identity: identity(),
      turnId: 'turn_orch_002' as McsRuntimeTurnId,
      packet: {},
    });

    expect(plan.decision).toBe('reject');
    expect(plan.behavior).toBe('not_implemented');
    const eventTypes = plan.events.map((envelope) => envelope.eventType);
    expect(eventTypes).toContain('context.packet.rejected');
    expect(eventTypes).toContain('agent.guardrail.blocked');
    for (const envelope of plan.events) {
      expect(() => assertValidRuntimeEventEnvelope(envelope)).not.toThrow();
    }
  });
});
