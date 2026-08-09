/**
 * /api/agents - orchestration layer over existing BA-facing agent surfaces.
 *
 * - /recommendations and /events are read-model + event records.
 * - /support is the multi-agent support runtime entry for cockpit-side
 *   interactive guidance. Michael remains catalog-driven; Ivory remains LLM-backed
 *   and compliance-guarded.
 */

import { Router, type Request, type Response } from 'express';
import type {
  McsAgentEventResponse,
  McsAgentRecommendationsResponse,
  McsCreateAgentEventPayload,
  McsIvoryAngle,
  McsIvoryCoachPayload,
  McsIvoryCoachResponse,
  McsIvoryInvitationDraftPayload,
  McsIvoryInvitationDraftResponse,
} from '@momentum/shared';
import { appendGeneratedOutputAudit } from '../domain/generatedOutputAudit.js';
import {
  draftIvoryInvitation,
  listIvoryNamesForBA,
  ivoryCoach,
} from '../domain/ivory.js';
import type { SteveChatTurn } from '../domain/steveConversationRuntime.js';
import {
  converseWithSteve,
  loadConversation,
  SteveAlreadyCompleteError,
} from '../domain/steveConversationRuntime.js';
import {
  AgentEventValidationError,
  getAgentRecommendations,
  recordAgentEvent,
} from '../domain/agents/orchestrator.js';
import {
  createMichaelRuntimeTurnForAuthenticatedBa,
  resolveMichaelRuntimeTurnResponse,
} from '../runtime/orchestration/index.js';
import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
} from '../config/michaelRuntimeFlags.js';
import {
  recordLlmProviderDegradation,
} from '../services/llmProviderObservability.js';
import {
  recordMichaelRuntimeFacadeFailure,
  recordMichaelRuntimeResponseDisabled,
  recordMichaelRuntimeRouteDisabled,
  recordMichaelRuntimeSuccess,
} from '../services/michaelRuntimeObservability.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';

export const agentRoutes: Router = Router();

const AGENT_SUPPORT_AGENTS = new Set(['michael', 'ivory', 'both']);
const SUPPORT_LANGUAGES = new Set<'en' | 'es'>(['en', 'es']);
const MICHAEL_SUPPORT_FIELDS = new Set(['ask', 'language']);
const IVORY_SUPPORT_FIELDS = new Set(['ask', 'angle', 'productName', 'rosterSize']);
const IVORY_INVITATION_DRAFT_FIELDS = new Set([
  'ivoryId',
  'relationshipReason',
  'productName',
]);
const STEVE_SUPPORT_FIELDS = new Set(['message']);
const MAX_SUPPORT_ASK_LENGTH = 500;
const MAX_SUPPORT_PRODUCT_NAME = 120;
const MAX_SUPPORT_ROSTER_SIZE = 20000;
const MAX_RELATIONSHIP_REASON_LENGTH = 600;
const MAX_STEVE_MESSAGE_LENGTH = 4000;

type SupportAgentKey = 'michael' | 'ivory' | 'both';
type MichaelSupportStatus =
  | 'ready'
  | 'disabled'
  | 'response_disabled'
  | 'error';
type IvorySupportStatus = 'ready' | 'error';

interface MichaelSupportResult {
  agent: 'michael';
  status: MichaelSupportStatus;
  responseType?: 'next_training_step' | 'clarification_question' | 'safe_fallback' | 'safe_close';
  text: string;
  language?: 'en' | 'es';
  nextStep?: { title?: string; instruction?: string; label?: string };
  supportingContext?: Array<{ title: string; summary: string }>;
}

interface IvorySupportResult {
  agent: 'ivory';
  status: IvorySupportStatus;
  coaching: string;
  prompts: string[];
  degraded: boolean;
  angle: McsIvoryAngle;
  rosterSize: number;
}

interface SteveSupportResult {
  agent: 'steve';
  status: 'ready' | 'error';
  text: string;
  done: boolean;
  extractionPending: boolean;
  turns: SteveChatTurn[];
}

type AgentSupportResult = MichaelSupportResult | IvorySupportResult;

interface McsAgentSupportResponse {
  ok: true;
  generatedAt: string;
  requestedAgent: SupportAgentKey;
  items: AgentSupportResult[];
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw);
}

function parseSupportedBody(
  raw: unknown,
  allowedFields: ReadonlySet<string>,
): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  for (const key of Object.keys(raw)) {
    if (!allowedFields.has(key)) return null;
  }
  return raw;
}

function buildAgentSupportResponse(
  requestedAgent: SupportAgentKey,
  items: AgentSupportResult[],
): McsAgentSupportResponse {
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    requestedAgent,
    items,
  };
}

function parseIvoryDraftText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

function parseSupportAgent(raw: unknown): SupportAgentKey | null {
  if (typeof raw !== 'string') return null;
  const normalized = raw.trim().toLowerCase();
  return AGENT_SUPPORT_AGENTS.has(normalized) ? (normalized as SupportAgentKey) : null;
}

function parseSupportLanguage(raw: unknown): 'en' | 'es' {
  return typeof raw === 'string' && SUPPORT_LANGUAGES.has(raw as 'en' | 'es')
    ? (raw as 'en' | 'es')
    : 'en';
}

function parseSupportAsk(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim() : '';
}

function parseSupportAngle(raw: unknown): McsIvoryAngle {
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (
      normalized === 'do_the_business' ||
      normalized === 'make_money' ||
      normalized === 'lose_fat' ||
      normalized === 'unspecified'
    ) {
      return normalized;
    }
  }
  return 'unspecified';
}

function parseSupportProductName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().slice(0, MAX_SUPPORT_PRODUCT_NAME);
  return value.length > 0 ? value : null;
}

function parseSupportRosterSize(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const next = Math.floor(raw);
  if (next < 0 || next > MAX_SUPPORT_ROSTER_SIZE) return null;
  return next;
}

function safeText(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t.length > 0 ? t : fallback;
  }
  return fallback;
}

function parseSafeNextStep(
  raw: unknown,
): { title?: string; instruction?: string; label?: string } | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const next = raw as { title?: unknown; instruction?: unknown; label?: unknown };
  const out: { title?: string; instruction?: string; label?: string } = {};
  if (typeof next.title === 'string' && next.title.trim()) {
    out.title = next.title.trim().slice(0, 120);
  }
  if (typeof next.instruction === 'string' && next.instruction.trim()) {
    out.instruction = next.instruction.trim().slice(0, 400);
  }
  if (typeof next.label === 'string' && next.label.trim()) {
    out.label = next.label.trim().slice(0, 64);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseSafeSupportingContext(
  raw: unknown,
): Array<{ title: string; summary: string }> {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const item = entry as { title?: unknown; summary?: unknown };
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const summary = typeof item.summary === 'string' ? item.summary.trim() : '';
    if (!title || !summary) return [];
    return [{ title: title.slice(0, 90), summary: summary.slice(0, 220) }];
  });
}

async function resolveMichaelSupportForBa(
  tmagId: string,
  input: { language: 'en' | 'es'; ask: string },
): Promise<MichaelSupportResult> {
  if (!michaelRuntimeRouteEnabled()) {
    recordMichaelRuntimeRouteDisabled();
    return {
      agent: 'michael',
      status: 'disabled',
      responseType: 'safe_fallback',
      text: 'Michael support is not available yet.',
    };
  }
  if (!michaelRuntimeResponseEnabled()) {
    recordMichaelRuntimeResponseDisabled();
    return {
      agent: 'michael',
      status: 'response_disabled',
      responseType: 'safe_fallback',
      text: 'Michael support responses are currently paused.',
    };
  }

  let created;
  try {
    created = await createMichaelRuntimeTurnForAuthenticatedBa({
      tmagId,
      language: input.language,
      turnContent: input.ask,
    });
  } catch {
    recordMichaelRuntimeFacadeFailure();
    return {
      agent: 'michael',
      status: 'error',
      text: 'Michael support could not be generated right now.',
    };
  }

  if (!created.ok) {
    recordMichaelRuntimeFacadeFailure();
    return {
      agent: 'michael',
      status: 'error',
      text: 'Michael support could not be generated right now.',
    };
  }

  let resolved;
  try {
    resolved = resolveMichaelRuntimeTurnResponse(created.input);
  } catch {
    recordMichaelRuntimeFacadeFailure();
    return {
      agent: 'michael',
      status: 'error',
      text: 'Michael support could not be generated right now.',
    };
  }

  if (!resolved.ok || typeof resolved.response !== 'object' || resolved.response === null) {
    recordMichaelRuntimeFacadeFailure();
    return {
      agent: 'michael',
      status: 'error',
      text: 'Michael support could not be generated right now.',
    };
  }

  const source = resolved.response as {
    responseType?: unknown;
    text?: unknown;
    language?: unknown;
    nextStep?: unknown;
    supportingContext?: unknown;
  };
  const responseType = source.responseType;
  if (
    responseType !== 'next_training_step' &&
    responseType !== 'clarification_question' &&
    responseType !== 'safe_fallback' &&
    responseType !== 'safe_close'
  ) {
    recordMichaelRuntimeFacadeFailure();
    return {
      agent: 'michael',
      status: 'error',
      text: 'Michael support output is unavailable right now.',
    };
  }

  recordMichaelRuntimeSuccess();
  return {
    agent: 'michael',
    status: 'ready',
    responseType,
    text: safeText(source.text, 'No guidance was produced.'),
    language: source.language === 'es' ? 'es' : 'en',
    nextStep: parseSafeNextStep(source.nextStep),
    supportingContext: parseSafeSupportingContext(source.supportingContext),
  };
}

async function resolveIvorySupportForBa(
  tmagId: string,
  input: {
    ask: string;
    angle: McsIvoryAngle;
    rosterSize: number;
    productName: string | null;
    ip: string | null;
    userAgent: string | null;
  },
): Promise<IvorySupportResult> {
  const payload: McsIvoryCoachPayload = {
    angle: input.angle,
    rosterSize: input.rosterSize,
    ask: input.ask,
    ...(input.productName ? { productName: input.productName } : {}),
  };

  try {
    const result: McsIvoryCoachResponse = await ivoryCoach(payload);
    if (result.degraded) {
      recordLlmProviderDegradation('ivory_wdyk_coach');
    }
    await appendGeneratedOutputAudit({
      templateId: 'ivory_wdyk_coach',
      tmagId,
      input: {
        classification: 'ivory_wdyk_coach',
        angle: input.angle,
        rosterSize: input.rosterSize,
        productNameProvided: input.productName !== null,
        askProvided: input.ask.length > 0,
        askLength: input.ask.length,
      },
      output: [result.coaching, ...result.prompts],
      degraded: result.degraded,
      context: {
        ip: input.ip,
        userAgent: input.userAgent,
        route: '/api/agents/support',
        method: 'POST',
        requestId: null,
      },
    });

    return {
      agent: 'ivory',
      status: 'ready',
      coaching: result.coaching,
      prompts: result.prompts.slice(0, 8),
      degraded: result.degraded,
      angle: input.angle,
      rosterSize: input.rosterSize,
    };
  } catch {
  return {
      agent: 'ivory',
      status: 'error',
      coaching:
        'Couldn’t load Ivory support right now. Open Ivory for manual guidance.',
      prompts: [],
      degraded: true,
      angle: input.angle,
      rosterSize: input.rosterSize,
    };
  }
}

function michaelRuntimeCapabilityState() {
  return {
    routeEnabled: michaelRuntimeRouteEnabled(),
    responseEnabled: michaelRuntimeResponseEnabled(),
  };
}

async function handleMichaelSupportRequest(
  req: Request,
  res: Response,
): Promise<Response> {
  const tmagId = req?.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = parseSupportedBody(req.body, MICHAEL_SUPPORT_FIELDS);
  if (!body) return res.status(400).json({ ok: false, error: 'unsupported_input' });

  const language = parseSupportLanguage(body.language);
  const ask = parseSupportAsk(body.ask);
  if (ask.length > MAX_SUPPORT_ASK_LENGTH) {
    return res
      .status(400)
      .json({ ok: false, error: 'ask_too_long', maxLength: MAX_SUPPORT_ASK_LENGTH });
  }

  const result = await resolveMichaelSupportForBa(tmagId, { language, ask });
  const payload = buildAgentSupportResponse('michael', [result]);
  return res.status(200).json(payload);
}

async function handleIvorySupportRequest(
  req: Request,
  res: Response,
): Promise<Response> {
  const tmagId = req?.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = parseSupportedBody(req.body, IVORY_SUPPORT_FIELDS);
  if (!body) return res.status(400).json({ ok: false, error: 'unsupported_input' });

  const ask = parseSupportAsk(body.ask);
  if (ask.length > MAX_SUPPORT_ASK_LENGTH) {
    return res
      .status(400)
      .json({ ok: false, error: 'ask_too_long', maxLength: MAX_SUPPORT_ASK_LENGTH });
  }
  const angle = parseSupportAngle(body.angle);
  const productName = parseSupportProductName(body.productName);
  const incomingRosterSize = parseSupportRosterSize(body.rosterSize);
  let rosterSize = incomingRosterSize;
  if (rosterSize === null) {
    try {
      const names = await listIvoryNamesForBA(tmagId);
      rosterSize = names.length;
    } catch {
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  }

  const result = await resolveIvorySupportForBa(tmagId, {
    ask,
    angle,
    rosterSize,
    productName,
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
  const payload = buildAgentSupportResponse('ivory', [result]);
  return res.status(200).json(payload);
}

async function handleIvoryInvitationDraftRequest(
  req: Request,
  res: Response,
): Promise<Response> {
  const tmagId = req?.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = parseSupportedBody(req.body, IVORY_INVITATION_DRAFT_FIELDS);
  if (!body) return res.status(400).json({ ok: false, error: 'unsupported_input' });

  const payload = body as Partial<McsIvoryInvitationDraftPayload>;
  const ivoryId = parseIvoryDraftText(payload.ivoryId);
  const relationshipReason = parseIvoryDraftText(payload.relationshipReason);
  const productName = parseIvoryDraftText(payload.productName);
  if (!ivoryId) {
    return res.status(400).json({ ok: false, error: 'invalid_ivory_id' });
  }
  if (!relationshipReason) {
    return res.status(400).json({ ok: false, error: 'missing_relationship_reason' });
  }
  if (relationshipReason.length > MAX_RELATIONSHIP_REASON_LENGTH) {
    return res
      .status(400)
      .json({ ok: false, error: 'relationship_reason_too_long' });
  }
  if (productName && productName.length > MAX_SUPPORT_PRODUCT_NAME) {
    return res.status(400).json({ ok: false, error: 'invalid_product_name' });
  }

  try {
    const result = await draftIvoryInvitation(tmagId, {
      ivoryId,
      relationshipReason,
      ...(productName ? { productName } : {}),
    });
    await appendGeneratedOutputAudit({
      templateId: 'ivory_personal_invitation',
      tmagId,
      input: {
        classification: 'ivory_personal_invitation',
        ivoryRecordProvided: true,
        relationshipReasonProvided: true,
        relationshipReasonLength: relationshipReason.length,
        productNameProvided: productName.length > 0,
      },
      output: [result.draft],
      degraded: result.degraded,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/agents/ivory/invitation-draft',
        method: 'POST',
        requestId: null,
      },
    });

    const out: McsIvoryInvitationDraftResponse = result;
    return res.status(200).json(out);
  } catch {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

async function handleSteveSupportRequest(
  req: Request,
  res: Response,
): Promise<Response> {
  const tmagId = req?.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = parseSupportedBody(req.body, STEVE_SUPPORT_FIELDS);
  if (!body) return res.status(400).json({ ok: false, error: 'unsupported_input' });

  const message = parseSupportAsk(body.message);
  if (message.length > MAX_STEVE_MESSAGE_LENGTH) {
    return res.status(400).json({
      ok: false,
      error: 'message_too_long',
      maxLength: MAX_STEVE_MESSAGE_LENGTH,
    });
  }

  try {
    const result = await converseWithSteve(tmagId, message);
    const turns = result.turns ?? [];
    const payload: SteveSupportResult & { ok: true; generatedAt: string } = {
      ok: true,
      generatedAt: new Date().toISOString(),
      agent: 'steve',
      status: 'ready',
      text: result.reply,
      done: result.done,
      extractionPending: result.extractionPending,
      turns,
    };
    return res.status(200).json(payload);
  } catch (err) {
    if (err instanceof SteveAlreadyCompleteError) {
      const turns = await loadConversation(tmagId);
      return res.status(200).json({
        ok: true,
        generatedAt: new Date().toISOString(),
        agent: 'steve',
        status: 'ready',
        text: 'Discovery is already complete. Open your Steve conversation log for next steps.',
        done: true,
        extractionPending: false,
        turns,
      });
    }
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
}

agentRoutes.get(
  '/recommendations',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }

    try {
      const payload: McsAgentRecommendationsResponse = await getAgentRecommendations(tmagId);
      return res.status(200).json(payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/agents/recommendations] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

agentRoutes.post(
  '/events',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) {
      return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    }

    try {
      const event = await recordAgentEvent(
        tmagId,
        (req.body ?? {}) as McsCreateAgentEventPayload,
      );
      const payload: McsAgentEventResponse = { ok: true, event };
      return res.status(201).json(payload);
    } catch (err) {
      if (err instanceof AgentEventValidationError) {
        return res.status(400).json({ ok: false, error: err.code });
      }
      // eslint-disable-next-line no-console
      console.error('[POST /api/agents/events] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

agentRoutes.post(
  '/support',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const tmagId = req.session?.tmagId;
    if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const body = parseSupportedBody(
      req.body,
      new Set(['agent', 'language', 'ask', 'angle', 'productName', 'rosterSize']),
    );
    if (!body) {
      return res.status(400).json({ ok: false, error: 'unsupported_input' });
    }
    const allowed = new Set(['agent', 'language', 'ask', 'angle', 'productName', 'rosterSize']);
    for (const key of Object.keys(body)) {
      if (!allowed.has(key)) {
        return res.status(400).json({ ok: false, error: 'unsupported_input' });
      }
    }

    const requestedAgent = body.agent === undefined ? 'both' : parseSupportAgent(body.agent);
    if (requestedAgent === null) {
      return res.status(400).json({ ok: false, error: 'invalid_agent' });
    }

    const language = parseSupportLanguage(body.language);
    const ask = parseSupportAsk(body.ask);
    if (ask.length > MAX_SUPPORT_ASK_LENGTH) {
      return res
        .status(400)
        .json({ ok: false, error: 'ask_too_long', maxLength: MAX_SUPPORT_ASK_LENGTH });
    }

    const angle = parseSupportAngle(body.angle);
    const productName = parseSupportProductName(body.productName);
    const incomingRosterSize = parseSupportRosterSize(body.rosterSize);
    const includeIvory = requestedAgent === 'ivory' || requestedAgent === 'both';
    const includeMichael = requestedAgent === 'michael' || requestedAgent === 'both';

    let rosterSize = incomingRosterSize;
    if (includeIvory && rosterSize === null) {
      try {
        const names = await listIvoryNamesForBA(tmagId);
        rosterSize = names.length;
      } catch {
        return res.status(500).json({ ok: false, error: 'server_error' });
      }
    }

    const supportContext = {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
    };

    const workers: Array<Promise<AgentSupportResult>> = [];
    if (includeMichael) {
      workers.push(
        resolveMichaelSupportForBa(tmagId, {
          language,
          ask,
        }),
      );
    }
    if (includeIvory && rosterSize !== null) {
      workers.push(
        resolveIvorySupportForBa(tmagId, {
          ask,
          angle,
          rosterSize,
          productName,
          ip: supportContext.ip,
          userAgent: supportContext.userAgent,
        }),
      );
    }

    const workerResults = await Promise.all(workers);
    const payload: McsAgentSupportResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      requestedAgent,
      items: workerResults,
    };
    return res.status(200).json(payload);
  },
);

agentRoutes.post(
  '/michael',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    return handleMichaelSupportRequest(req, res);
  },
);

agentRoutes.get('/michael/session', requireAuth, requireSteveComplete, (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }
  res.status(200).json({
    ok: true,
    agent: 'michael',
    tmagId,
    capability: michaelRuntimeCapabilityState(),
  });
});

agentRoutes.post(
  '/michael/response',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    return handleMichaelSupportRequest(req, res);
  },
);

agentRoutes.post('/michael/complete', requireAuth, requireSteveComplete, (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }
  res.status(200).json({ ok: true, agent: 'michael', tmagId, completed: true });
});

agentRoutes.post(
  '/ivory',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    return handleIvorySupportRequest(req, res);
  },
);

agentRoutes.post(
  '/ivory/invitation-draft',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    return handleIvoryInvitationDraftRequest(req, res);
  },
);

agentRoutes.get('/steve/session', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }

  try {
    const turns = await loadConversation(tmagId);
    return res.status(200).json({ ok: true, agent: 'steve', turns, messageCount: turns.length });
  } catch {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

agentRoutes.post(
  '/steve',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    return handleSteveSupportRequest(req, res);
  },
);

agentRoutes.post('/steve/response', requireAuth, requireSteveComplete, async (req, res) => {
  return handleSteveSupportRequest(req, res);
});

agentRoutes.post('/steve/complete', requireAuth, requireSteveComplete, (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }
  return res.status(200).json({ ok: true, agent: 'steve', tmagId, completed: true });
});
