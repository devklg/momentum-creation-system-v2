import type { AgentKey, ContextPacketV1 } from '@momentum/shared/runtime';
// Structural validation only. The Context Manager remains the sole assembler;
// this module imports the validator, never the packet builder.
import { validateContextPacket } from '../context/contextManager.js';
import { getAgentDescriptor, isKnownAgentKey } from './registry.js';
import type {
  ConsumeContextPacketInput,
  ContextPacketConsumptionIssue,
  ContextPacketConsumptionResult,
} from './types.js';

/**
 * S2.1 Context Packet consumption.
 *
 * Agents consume `context_packet.v1` only. This helper:
 *  1. runs the canonical structural validation (Context Manager output shape);
 *  2. confirms the packet matches the expected agent and an allowed objective;
 *  3. confirms Context Manager assembled it and candidate knowledge is excluded;
 *  4. gates substantive guidance on packet status (complete / degraded / failed).
 *
 * It performs NO retrieval, NO assembly, and NO persistence.
 */
export function consumeContextPacket(
  input: ConsumeContextPacketInput,
): ContextPacketConsumptionResult {
  const { expectedAgentKey, packet, requireSubstantive = true } = input;
  const issues: ContextPacketConsumptionIssue[] = [];

  const structural = validateContextPacket(packet);
  if (!structural.ok) {
    return {
      decision: 'reject',
      expectedAgentKey,
      issues: structural.errors.map((error) => ({
        path: error.path,
        code: error.code,
        message: error.message,
      })),
    };
  }

  const valid: ContextPacketV1 = structural.packet;
  const packetAgentKey = valid.agent.agentKey;
  const taskType = valid.session.taskType;
  const packetStatus = valid.packetStatus;

  // Context Manager must be the assembler.
  if (valid.metadata?.generatedBy !== 'context_manager') {
    issues.push(
      issue(
        'metadata.generatedBy',
        'assembler_not_context_manager',
        'Context Packet must be assembled by the Context Manager.',
      ),
    );
  }

  // Packet agent must match the agent the orchestrator is running.
  if (!isKnownAgentKey(packetAgentKey) || packetAgentKey !== expectedAgentKey) {
    issues.push(
      issue(
        'agent.agentKey',
        'agent_mismatch',
        `Packet agentKey ${String(packetAgentKey)} does not match expected agent ${expectedAgentKey}.`,
      ),
    );
  }

  // Objective (task type) must be allowed for this agent.
  const descriptor = getAgentDescriptor(expectedAgentKey);
  if (!descriptor.allowedTaskTypes.includes(taskType)) {
    issues.push(
      issue(
        'session.taskType',
        'objective_not_allowed',
        `Task type ${taskType} is not an allowed objective for ${expectedAgentKey}.`,
      ),
    );
  }

  // Runtime mode must be supported by this agent.
  if (!descriptor.supportedModes.includes(valid.session.mode)) {
    issues.push(
      issue(
        'session.mode',
        'mode_not_supported',
        `Runtime mode ${valid.session.mode} is not supported for ${expectedAgentKey}.`,
      ),
    );
  }

  // Language must be a supported runtime language.
  if (!descriptor.supportedLanguages.includes(valid.language.primary)) {
    issues.push(
      issue(
        'language.primary',
        'language_not_supported',
        `Language ${valid.language.primary} is not supported for ${expectedAgentKey}.`,
      ),
    );
  }

  // Candidate / review-only knowledge stays excluded by default.
  if (
    valid.retrievalAudit.candidateKnowledgeIncluded !== false ||
    valid.retrievalAudit.candidateKnowledgeExcluded !== true
  ) {
    issues.push(
      issue(
        'retrievalAudit',
        'candidate_knowledge_not_excluded',
        'Candidate and review-only knowledge must be excluded by default.',
      ),
    );
  }

  if (issues.length > 0) {
    return {
      decision: 'reject',
      expectedAgentKey,
      packetAgentKey: isKnownAgentKey(packetAgentKey) ? packetAgentKey : undefined,
      taskType,
      packetStatus,
      issues,
    };
  }

  if (packetStatus === 'failed') {
    return {
      decision: 'block_substantive',
      expectedAgentKey,
      packetAgentKey: packetAgentKey as AgentKey,
      taskType,
      packetStatus,
      issues,
    };
  }

  if (packetStatus === 'degraded') {
    return {
      decision: 'degraded',
      expectedAgentKey,
      packetAgentKey: packetAgentKey as AgentKey,
      taskType,
      packetStatus,
      packet: valid,
      issues,
    };
  }

  // packetStatus === 'complete'
  void requireSubstantive;
  return {
    decision: 'proceed',
    expectedAgentKey,
    packetAgentKey: packetAgentKey as AgentKey,
    taskType,
    packetStatus,
    packet: valid,
    issues,
  };
}

function issue(
  path: string,
  code: string,
  message: string,
): ContextPacketConsumptionIssue {
  return { path, code, message };
}
