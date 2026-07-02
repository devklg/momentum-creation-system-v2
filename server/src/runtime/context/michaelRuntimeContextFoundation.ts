/**
 * S3.10 remediation — CONTEXT-LAYER Michael runtime Context Packet foundation.
 *
 * This module is the SANCTIONED home for Michael runtime Context Packet
 * ASSEMBLY. Packet assembly belongs to the Context Manager (the context layer),
 * NEVER to the orchestration layer. The server-owned orchestration turn source
 * (`server/src/runtime/orchestration/michaelRuntimeTurnSource.ts`) injects the
 * port returned here instead of assembling a packet itself.
 *
 * The factory takes SESSION-DERIVED BA identity only (tmagId, transport mode, the
 * turn's createdAt) and returns a production `ContextManagerRequestPort`:
 *
 *  - `assembledBy: 'context_manager'` — the only sanctioned assembler;
 *  - `requestContextPacket(scope, request)` assembles an empty-approved-knowledge,
 *    candidate/review-only-excluded `context_packet.v1` stamped
 *    `packetStatus: 'degraded'`. This is the knowledge-honest, store-free packet
 *    the inert S2.20 facade deterministically resolves to the pre-authored
 *    `safe_fallback` response;
 *  - boundary-clean — it imports NO store/PERSISTENCE/GraphRAG/retrieval client and
 *    never persists. It depends only on the context layer plus shared types, and
 *    type-only imports the port shape from the orchestration layer (erased at
 *    runtime — no reverse runtime dependency).
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
// Type-only import: the port SHAPE is defined once in the orchestration layer.
// `import type` is fully erased at runtime, so the context layer keeps no
// runtime dependency on orchestration (no reverse layering at runtime).
import type { ContextManagerRequestPort } from '../orchestration/types.js';
import { buildContextPacket } from './contextManager.js';

const MICHAEL_AGENT_KEY = 'michael_magnificent' as const;
const OBJECTIVE = 'training_support' as const;

// Server-side Team Magnificent scope constants (never body-derived). Only the
// teamKey/teamName are contract-validated; tenant/team ids are opaque non-empty
// identifiers aligned with the rest of the runtime layer.
const TENANT_ID = 'tenant_team_magnificent' as McsTenantId;
const TEAM_ID = 'team_magnificent' as McsTeamId;
const TENANT_NAME = 'Team Magnificent Tenant';

/**
 * Session-derived inputs needed to assemble the degraded Michael packet. Carries
 * ONLY server-derived identity — no body tmagId/sponsorTmagId/targetTmagId, no
 * prospect/session token, no client-supplied packet or raw retrieval output.
 */
export interface MichaelRuntimeContextFoundationInput {
  /** Authenticated BA id — sourced from the session only. */
  readonly tmagId: TmagId;
  /** BA runtime transport mode, server-derived. */
  readonly mode: McsRuntimeMode;
  /** ISO timestamp anchoring the assembled session context. */
  readonly createdAt: string;
}

/**
 * Build the production Context Manager request port for a degraded, fail-closed
 * Michael runtime turn. The returned port assembles an empty-approved-knowledge,
 * candidate-excluded `context_packet.v1` from session identity alone — no store,
 * no retrieval, no PERSISTENCE. This is the ONLY place Michael packet assembly lives.
 */
export function createMichaelRuntimeContextManagerPort(
  input: MichaelRuntimeContextFoundationInput,
): ContextManagerRequestPort {
  const { tmagId, mode, createdAt } = input;

  return {
    assembledBy: 'context_manager',
    async requestContextPacket(
      _scope: McsRuntimeRequestScope,
      request: McsContextPacketRequest,
    ): Promise<McsContextPacketV1> {
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
            canUseBrowserVoice: false,
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
        agentKey: MICHAEL_AGENT_KEY,
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
        // Fail-closed: no active retrieval / no approved knowledge enrichment.
        packetStatus: 'degraded',
      });
    },
  };
}

function resolveEnvironment(): McsTenantContext['environment'] {
  const env = process.env.NODE_ENV;
  if (env === 'production') return 'production';
  if (env === 'staging') return 'staging';
  return 'development';
}
