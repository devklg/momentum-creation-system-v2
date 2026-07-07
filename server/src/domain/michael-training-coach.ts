/**
 * Michael Training Coach — generated BA-facing training support.
 *
 * This is the production generation path behind /api/michael-runtime/resolve.
 * The existing turn source still owns session-derived identity and Context
 * Packet assembly; this module consumes that safe turn, calls Anthropic, and
 * persists the generated turn as a separate operational record.
 */

import { complete, AnthropicConfigError } from '../services/anthropic.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  MichaelRuntimeAdapterContractInput,
} from '../runtime/orchestration/index.js';
import type { McsContextPacketV1 } from '@momentum/shared/runtime';

const MONGO_DB = 'momentum';
const TURNS_COLLECTION = 'tmag_michael_runtime_turns';
const CHROMA_TURNS = 'mcs_michael_runtime_turns';

export interface MichaelGeneratedRuntimeResult {
  response: {
    schemaVersion: 'michael_generated_response.v1';
    responseType: 'next_training_step' | 'clarification_question' | 'safe_fallback';
    agentKey: 'michael_magnificent';
    taskType: 'training_support';
    sessionId: string;
    turnId: string;
    correlationId: string;
    contextPacketStatus: string;
    language: 'en' | 'es';
    text: string;
    safety: {
      validationStatus: 'passed' | 'degraded';
      guardrailIds: string[];
      blockedReasonCodes: string[];
    };
    persistence: 'triple_stack';
    generatedAt: string;
    agentResponseGenerated: true;
    contextPacketId?: string;
    nextStep?: {
      label: string;
      title: string;
      instruction: string;
      baOwned: true;
      automaticSending: false;
      automaticCalling: false;
      externalSideEffect: false;
    };
  };
  supportingContext: Array<{ title: string; summary: string }>;
  persistence: { turnId: string; readbackVerified: true };
}

export function buildMichaelSystemPrompt(input: {
  baFirstName: string;
  language: 'en' | 'es';
  contextSupplement: string;
}): string {
  const name = input.baFirstName.trim() || 'there';
  const languageLine =
    input.language === 'es'
      ? 'Answer in warm, natural Spanish unless the BA clearly asks otherwise.'
      : 'Answer in warm, natural English unless the BA clearly asks otherwise.';

  return [
    'You are Michael, the Team Magnificent Training Agent and Daily Success Coach.',
    'You are BA-facing only. You never speak to prospects and never automate outreach.',
    '',
    'YOUR ROLE:',
    '- Help the Brand Ambassador take the next simple training/support step.',
    '- Teach with patience, clarity, and service.',
    '- Keep the work duplicable: People Before Content, Progress Before Perfection, Simplicity Creates Duplication, Education Before Promotion.',
    '- Support transformation over information dumping.',
    '',
    'HARD COMPLIANCE RULES:',
    '- Do not state or imply income, earnings, commissions, cycle math, rank advancement, placement, spillover, guarantees, or medical outcomes.',
    '- Do not score, rank, classify, qualify, or predict the BA or any prospect.',
    '- Do not tell the BA you will send, call, schedule, dial, enroll, or follow up for them.',
    '- Do not approve knowledge, change policy, or claim THREE International authority.',
    '- If the question asks for prohibited territory, redirect to a safe training step.',
    '',
    'RESPONSE STYLE:',
    `- Address the BA as ${name}.`,
    `- ${languageLine}`,
    '- Give one concise coaching answer and one BA-owned next step.',
    '- Never expose Context Packet labels, source ids, retrieval ids, or internal system details.',
    input.contextSupplement,
    '',
    'Return plain text only. No JSON. No markdown table.',
  ].filter(Boolean).join('\n');
}

export function renderMichaelContextSupplement(packet: McsContextPacketV1 | null): {
  prompt: string;
  supportingContext: Array<{ title: string; summary: string }>;
} {
  if (!packet || packet.approvedKnowledge.length === 0) {
    return { prompt: '', supportingContext: [] };
  }

  const supportingContext = packet.approvedKnowledge.slice(0, 6).map((item, index) => ({
    title: (item.title || `Approved knowledge ${index + 1}`).replace(/\s+/g, ' ').trim().slice(0, 90),
    summary: (item.summary || '').replace(/\s+/g, ' ').trim().slice(0, 220),
  })).filter((item) => item.title && item.summary);

  return {
    supportingContext,
    prompt: [
      '',
      'APPROVED KNOWLEDGE GROUNDING (system — background only):',
      '- Use these approved items for factual grounding.',
      '- Do not quote internal ids or retrieval mechanics.',
      '- Do not invent app facts when knowledge is missing.',
      `- Packet status: ${packet.packetStatus}.`,
      ...supportingContext.map((item, index) => `${index + 1}. ${item.title}: ${item.summary}`),
    ].join('\n'),
  };
}

async function getBaFirstName(tmagId: string): Promise<string> {
  try {
    const res = await persistenceCall<{ documents?: Array<{ firstName?: string }> }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: 'team_magnificent_members',
      filter: { tmagId },
      limit: 1,
    });
    return res.documents?.[0]?.firstName?.trim() || 'there';
  } catch {
    return 'there';
  }
}

function packetFromInput(input: MichaelRuntimeAdapterContractInput): McsContextPacketV1 | null {
  const result = input.runtimeTurn.result;
  if (result.decision !== 'proceed' && result.decision !== 'degraded') return null;
  return result.consumption.packet ?? null;
}

function sanitizeAsk(value: string | undefined): string {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || 'What is my next best training step today?';
}

async function persistMichaelTurn(input: {
  adapterInput: MichaelRuntimeAdapterContractInput;
  ask: string;
  reply: string;
  generatedAt: string;
  contextPacketStatus: string;
  contextPacketId?: string;
}): Promise<void> {
  const tmagId = String(input.adapterInput.identity.scope.tmagId ?? '');
  const turnId = String(input.adapterInput.turnId);
  const doc = {
    turnId,
    tmagId,
    sessionId: String(input.adapterInput.identity.sessionId),
    correlationId: String(input.adapterInput.identity.correlationId),
    language: input.adapterInput.language === 'es' ? 'es' : 'en',
    ask: input.ask,
    reply: input.reply,
    contextPacketStatus: input.contextPacketStatus,
    contextPacketId: input.contextPacketId ?? null,
    generatedAt: input.generatedAt,
    agentResponseGenerated: true,
  };

  await tripleStackWrite({
    id: turnId,
    mongoCollection: TURNS_COLLECTION,
    mongoDoc: doc,
    neo4j: {
      cypher:
        'MERGE (m:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'MERGE (t:MichaelRuntimeTurn {turnId: $id}) ' +
        'SET t.generatedAt = datetime($generatedAt), t.language = $language, ' +
        '    t.contextPacketStatus = $contextPacketStatus, t.agentResponseGenerated = true ' +
        'MERGE (m)-[:RECEIVED_MICHAEL_RUNTIME_TURN]->(t)',
      params: {
        tmagId,
        generatedAt: doc.generatedAt,
        language: doc.language,
        contextPacketStatus: doc.contextPacketStatus,
      },
    },
    chroma: {
      collection: CHROMA_TURNS,
      document: `Michael training support turn for ${tmagId}. Ask: ${input.ask}. Reply: ${input.reply}`,
      metadata: {
        kind: 'michael_runtime_turn',
        tmagId,
        language: doc.language,
        contextPacketStatus: doc.contextPacketStatus,
        generatedAt: doc.generatedAt,
      },
    },
  });

  const readback = await persistenceCall<{ documents?: Array<{ turnId?: string }> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: TURNS_COLLECTION,
    filter: { _id: turnId },
    limit: 1,
  });
  if (!readback.documents?.[0]) {
    throw new Error('michael_runtime_turn_readback_failed');
  }
}

export async function michaelConversationRuntime(input: {
  adapterInput: MichaelRuntimeAdapterContractInput;
  ask?: string;
}): Promise<MichaelGeneratedRuntimeResult> {
  const adapterInput = input.adapterInput;
  const language = adapterInput.language === 'es' ? 'es' : 'en';
  const tmagId = String(adapterInput.identity.scope.tmagId ?? '');
  const packet = packetFromInput(adapterInput);
  const { prompt: contextSupplement, supportingContext } = renderMichaelContextSupplement(packet);
  const baFirstName = await getBaFirstName(tmagId);
  const ask = sanitizeAsk(input.ask);
  const generatedAt = new Date().toISOString();

  const system = buildMichaelSystemPrompt({
    baFirstName,
    language,
    contextSupplement,
  });

  const completion = await complete({
    system,
    messages: [{ role: 'user', content: ask }],
    maxTokens: 900,
  });

  const text = completion.text.replace(/\s+/g, ' ').trim();
  const responseText = text || 'Let us keep this simple: review the next training step, write down one question, and bring that question back here.';
  const responseType = ask.endsWith('?') ? 'next_training_step' : 'next_training_step';
  const contextPacketStatus = packet?.packetStatus ?? 'missing';
  const contextPacketId = packet?.packetId ? String(packet.packetId) : undefined;

  await persistMichaelTurn({
    adapterInput,
    ask,
    reply: responseText,
    generatedAt,
    contextPacketStatus,
    ...(contextPacketId ? { contextPacketId } : {}),
  });

  return {
    response: {
      schemaVersion: 'michael_generated_response.v1',
      responseType,
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      sessionId: String(adapterInput.identity.sessionId),
      turnId: String(adapterInput.turnId),
      correlationId: String(adapterInput.identity.correlationId),
      contextPacketStatus,
      language,
      text: responseText,
      safety: {
        validationStatus: contextPacketStatus === 'complete' ? 'passed' : 'degraded',
        guardrailIds: ['michael_training_support_boundary', 'no_ai_prospecting', 'no_scoring'],
        blockedReasonCodes: [],
      },
      persistence: 'triple_stack',
      generatedAt,
      agentResponseGenerated: true,
      ...(contextPacketId ? { contextPacketId } : {}),
      nextStep: {
        label: language === 'es' ? 'Siguiente paso' : 'Next step',
        title: language === 'es' ? 'Una accion simple' : 'One simple action',
        instruction:
          language === 'es'
            ? 'Elige una accion de entrenamiento que puedas completar hoy y vuelve con una pregunta especifica.'
            : 'Choose one training action you can complete today, then come back with one specific question.',
        baOwned: true,
        automaticSending: false,
        automaticCalling: false,
        externalSideEffect: false,
      },
    },
    supportingContext,
    persistence: { turnId: String(adapterInput.turnId), readbackVerified: true },
  };
}

export function isMichaelDormantError(err: unknown): boolean {
  return err instanceof AnthropicConfigError;
}
