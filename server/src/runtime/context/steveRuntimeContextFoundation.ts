/**
 * Steve runtime Context Packet foundation.
 *
 * Steve is operational today as the browser-based Discovery interviewer. This
 * module gives that working runtime a safe path into the Context Manager /
 * approved Knowledge Base layer without changing Steve's persistence path or
 * giving Steve direct store access.
 */

import { randomUUID } from 'node:crypto';
import type {
  TmagId,
  McsContextPacketId,
  McsContextPacketRequest,
  McsContextPacketV1,
  McsContextRequestId,
  McsRuntimeMode,
  McsRuntimeRequestScope,
  McsTeamId,
  McsTenantContext,
  McsTenantId,
} from '@momentum/shared/runtime';
import {
  TEAM_MAGNIFICENT_KEY,
  TEAM_MAGNIFICENT_NAME,
} from '../events/index.js';
import type { ContextManagerRequestPort } from '../orchestration/types.js';
import { buildContextPacket } from './contextManager.js';

const STEVE_AGENT_KEY = 'steve_success' as const;
const OBJECTIVE = 'success_interview' as const;
const TENANT_ID = 'tenant_team_magnificent' as McsTenantId;
const TEAM_ID = 'team_magnificent' as McsTeamId;
const TENANT_NAME = 'Team Magnificent Tenant';

export interface SteveRuntimeContextFoundationInput {
  /** Authenticated BA id, sourced from the server session. */
  readonly tmagId: TmagId;
  /** Browser runtime mode for this Steve turn. */
  readonly mode: McsRuntimeMode;
  /** ISO timestamp anchoring the assembled session context. */
  readonly createdAt: string;
  /** Optional turn text used only to derive the approved-knowledge search query. */
  readonly turnContent?: string;
}

export function createSteveRuntimeContextManagerPort(
  input: SteveRuntimeContextFoundationInput,
): ContextManagerRequestPort {
  const { tmagId, mode, createdAt, turnContent } = input;

  return {
    assembledBy: 'context_manager',
    async requestContextPacket(
      scope: McsRuntimeRequestScope,
      request: McsContextPacketRequest,
    ): Promise<McsContextPacketV1> {
      if (steveContextManagerLiveEnabled()) {
        return requestLiveContextPacket({
          tmagId,
          mode,
          createdAt,
          turnContent,
          scope,
          request,
        });
      }

      return buildContextPacket({
        packetId: `ctx_packet_${randomUUID()}` as McsContextPacketId,
        requestId: request.requestId as unknown as McsContextRequestId,
        tenant: {
          tenantId: TENANT_ID,
          tenantName: TENANT_NAME,
          brandName: TEAM_MAGNIFICENT_NAME,
          environment: resolveEnvironment(),
        },
        team: {
          teamId: TEAM_ID,
          teamKey: TEAM_MAGNIFICENT_KEY,
          teamName: TEAM_MAGNIFICENT_NAME,
        },
        ba: {
          tenantId: TENANT_ID,
          teamId: TEAM_ID,
          teamKey: TEAM_MAGNIFICENT_KEY,
          teamName: TEAM_MAGNIFICENT_NAME,
          tmagId,
          journalEnabled: false,
          languagePreference: request.language,
          permissions: {
            canUsePrivateJournal: false,
            canSelectJournalForReview: false,
            canCreateKnowledgeCandidate: false,
            canAccessRelationshipContext: false,
            canUseBrowserVoice: mode !== 'browser_text',
            canUseBrowserText: true,
          },
        },
        session: {
          sessionId: request.sessionId,
          mode,
          status: 'active',
          taskType: request.taskType,
          startedAt: createdAt,
        },
        agentKey: STEVE_AGENT_KEY,
        objective: OBJECTIVE,
        language: {
          primary: request.language,
          userPreference: request.language,
          translationAllowed: false,
          translationStatus: 'same_language',
          machineTranslationUsed: false,
          humanReviewed: true,
        },
        provenance: {
          assembledBy: 'context_manager',
          requestId: request.requestId,
          componentVersion: 's1.5',
        },
        packetStatus: 'degraded',
      });
    },
  };
}

export async function requestSteveRuntimeContextPacket(
  input: SteveRuntimeContextFoundationInput,
): Promise<McsContextPacketV1> {
  const scope: McsRuntimeRequestScope = {
    tenantId: TENANT_ID,
    teamId: TEAM_ID,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: input.tmagId,
  };
  const request: McsContextPacketRequest = {
    requestId: `ctx_req_steve_${randomUUID()}` as McsContextPacketRequest['requestId'],
    sessionId: `steve_discovery_${input.tmagId}` as McsContextPacketRequest['sessionId'],
    agentKey: STEVE_AGENT_KEY,
    language: 'en',
    taskType: OBJECTIVE,
  };

  return (await createSteveRuntimeContextManagerPort(input).requestContextPacket(
    scope,
    request,
  )) as McsContextPacketV1;
}

async function requestLiveContextPacket(input: {
  readonly tmagId: TmagId;
  readonly mode: McsRuntimeMode;
  readonly createdAt: string;
  readonly turnContent: string | undefined;
  readonly scope: McsRuntimeRequestScope;
  readonly request: McsContextPacketRequest;
}): Promise<McsContextPacketV1> {
  const contextManagerModule = await import('./contextManagerService.js');
  const approvedKnowledgeStoreModule = await import('../../services/knowledge/approvedKnowledgeStore.js');
  const storedProvider = approvedKnowledgeStoreModule.createStoredApprovedKnowledgeProvider();
  const query = deriveSteveApprovedKnowledgeQuery(input.request, input.turnContent);
  const diagnosticsModule = await import('../../services/contextManagerDiagnostics.js');

  const result = await contextManagerModule.createContextManagerService(
    {
      async listApprovedKnowledge(scope) {
        return storedProvider.searchApprovedKnowledge(scope, query, undefined, input.request.language);
      },
    },
    {
      mode: input.mode,
      createdAt: input.createdAt,
      maxApprovedKnowledgeResults: 6,
      ba: {
        tmagId: input.tmagId,
        journalEnabled: false,
        languagePreference: input.request.language,
      },
      retrieval: { onRetrievalObservability: diagnosticsModule.recordContextManagerDiagnostic },
    },
  ).buildContext({ scope: input.scope, request: input.request });
  return result.packet;
}

function deriveSteveApprovedKnowledgeQuery(
  request: McsContextPacketRequest,
  turnContent: string | undefined,
): string {
  const normalizedTurn = turnContent?.replace(/\s+/g, ' ').trim();
  if (normalizedTurn) return normalizedTurn;
  return [
    request.agentKey,
    request.taskType,
    request.language,
    'Team Magnificent Steve Success discovery interview support learning style communication preferences',
  ].join(' ');
}

export function steveContextManagerLiveEnabled(): boolean {
  return process.env.STEVE_CONTEXT_MANAGER_LIVE_ENABLED === 'true';
}

function resolveEnvironment(): McsTenantContext['environment'] {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}
