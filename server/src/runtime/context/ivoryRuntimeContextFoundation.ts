/**
 * Ivory runtime Context Packet foundation.
 *
 * Ivory's live coach/draft paths predate the Context Manager. This module gives
 * those production paths the same approved-KB boundary as Michael and Steve
 * without giving Ivory direct store access or changing invitation persistence.
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

const IVORY_AGENT_KEY = 'ivory' as const;
const TENANT_ID = 'tenant_team_magnificent' as McsTenantId;
const TEAM_ID = 'team_magnificent' as McsTeamId;
const TENANT_NAME = 'Team Magnificent Tenant';

export type IvoryRuntimeContextTaskType =
  | 'relationship_coaching'
  | 'invitation_drafting';

export interface IvoryRuntimeContextFoundationInput {
  readonly tmagId: TmagId;
  readonly mode: McsRuntimeMode;
  readonly taskType: IvoryRuntimeContextTaskType;
  readonly createdAt: string;
  readonly turnContent?: string;
}

export function createIvoryRuntimeContextManagerPort(
  input: IvoryRuntimeContextFoundationInput,
): ContextManagerRequestPort {
  const { tmagId, mode, taskType, createdAt, turnContent } = input;

  return {
    assembledBy: 'context_manager',
    async requestContextPacket(
      scope: McsRuntimeRequestScope,
      request: McsContextPacketRequest,
    ): Promise<McsContextPacketV1> {
      if (ivoryContextManagerLiveEnabled()) {
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
            canAccessRelationshipContext: true,
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
        agentKey: IVORY_AGENT_KEY,
        objective: taskType,
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

export async function requestIvoryRuntimeContextPacket(
  input: IvoryRuntimeContextFoundationInput,
): Promise<McsContextPacketV1> {
  const scope: McsRuntimeRequestScope = {
    tenantId: TENANT_ID,
    teamId: TEAM_ID,
    teamKey: TEAM_MAGNIFICENT_KEY,
    teamName: TEAM_MAGNIFICENT_NAME,
    tmagId: input.tmagId,
  };
  const request: McsContextPacketRequest = {
    requestId: `ctx_req_ivory_${randomUUID()}` as McsContextPacketRequest['requestId'],
    sessionId: `ivory_${input.taskType}_${input.tmagId}` as McsContextPacketRequest['sessionId'],
    agentKey: IVORY_AGENT_KEY,
    language: 'en',
    taskType: input.taskType,
  };

  return (await createIvoryRuntimeContextManagerPort(input).requestContextPacket(
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
  const query = deriveIvoryApprovedKnowledgeQuery(input.request, input.turnContent);

  const result = await contextManagerModule.createContextManagerService(
    {
      async listApprovedKnowledge(scope) {
        return storedProvider.searchApprovedKnowledge(scope, query);
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
    },
  ).buildContext({ scope: input.scope, request: input.request });
  return result.packet;
}

function deriveIvoryApprovedKnowledgeQuery(
  request: McsContextPacketRequest,
  turnContent: string | undefined,
): string {
  const normalizedTurn = turnContent?.replace(/\s+/g, ' ').trim();
  if (normalizedTurn) return normalizedTurn;
  return [
    request.agentKey,
    request.taskType,
    request.language,
    'Team Magnificent Ivory relationship coaching invitation drafting compliance personal invitation',
  ].join(' ');
}

export function ivoryContextManagerLiveEnabled(): boolean {
  return (
    process.env.IVORY_CONTEXT_MANAGER_LIVE_ENABLED === 'true' ||
    process.env.MCS_CONTEXT_MANAGER_LIVE_ENABLED === 'true'
  );
}

function resolveEnvironment(): McsTenantContext['environment'] {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}
