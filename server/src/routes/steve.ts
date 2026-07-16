/**
 * /api/steve/* — Steve New BA Discovery & Success Interview routes (SEPARATE
 * agent; does NOT touch Michael graph data).
 *
 * BA self-reads:
 *   GET  /api/steve/discovery/state   → the BA's own discovery view
 *   GET  /api/steve/discovery/script  → the discovery backbone (read-only ref)
 *
 * Worker ↔ server (machine-to-machine, STEVE_WORKER_SECRET guarded):
 *   GET  /api/steve/discovery/system-prompt?tmagId=...  → system prompt string
 *   POST /api/steve/discovery/ingest                  → persist the artifact
 *
 * Legacy sponsor boundary:
 *   GET  /api/steve/discovery/profile/:downlineTmagId   → fails closed under
 *   ACR-0031 until field-specific BA consent exists. Sponsors use Michael's
 *   bounded training-support projection by default.
 *
 * Compliance: BA-facing only, never prospect-facing, never on .com. No income
 * or placement language anywhere (locked-spec 3.10/3.12). Steve never scores or
 * judges — the artifact carries the BA's own words.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import {
  MCS_STEVE_SPONSOR_CONSENT_FIELDS,
  MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY,
  MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY,
  MCS_STEVE_CORRECTABLE_PROFILE_LIST_FIELDS,
  MCS_STEVE_CORRECTABLE_PROFILE_TEXT_FIELDS,
  MCS_STEVE_CORRECTION_CONFIRMATION,
  MCS_STEVE_RETAKE_CONFIRMATION,
  MCS_STEVE_WITHDRAW_CONFIRMATION,
} from '@momentum/shared';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  STEVE_DISCOVERY_SECTIONS,
  buildSteveSystemPrompt,
  buildDiscoveryView,
  ingestDiscoveryArtifact,
  getProfileCardForSponsor,
  DiscoveryIngestError,
  SponsorAccessError,
} from '../domain/steve-success-interview.js';
import {
  SteveAlreadyCompleteError,
  converseWithSteve,
  loadConversation,
} from '../domain/steveConversationRuntime.js';
import {
  exportStevePrivateRecord,
  getStevePrivacyState,
  setSteveSponsorConsent,
  StevePrivacyError,
  withdrawStevePersonalization,
} from '../domain/stevePrivacy.js';
import { AnthropicConfigError } from '../services/anthropic.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import {
  correctStevePrivateRecord,
  SteveCorrectionError,
} from '../domain/steveCorrection.js';
import {
  startSteveRetake,
  SteveVersioningError,
} from '../domain/steveVersioning.js';

export const steveRoutes: Router = express.Router();

function markPrivate(res: Response): void {
  res.set('Cache-Control', 'private, no-store');
  res.set('Pragma', 'no-cache');
}

function privacyResponse(args: Awaited<ReturnType<typeof getStevePrivacyState>>) {
  return {
    ok: true as const,
    privacy: args.privacy,
    currentSponsorTmagId: args.currentSponsorTmagId,
    grantCopy: MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY,
    revocationCopy: MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY,
  };
}

function handleStevePrivacyError(err: unknown, res: Response): boolean {
  if (!(err instanceof StevePrivacyError)) return false;
  const status =
    err.code === 'WITHDRAWN' || err.code === 'NO_CURRENT_SPONSOR' ? 409 : 404;
  res.status(status).json({
    ok: false,
    error:
      status === 409
        ? 'Sponsor sharing is unavailable.'
        : 'Steve privacy controls are unavailable.',
    code:
      status === 409
        ? 'SPONSOR_SHARING_UNAVAILABLE'
        : 'STEVE_PRIVACY_UNAVAILABLE',
  });
  return true;
}

function handleSteveCorrectionError(err: unknown, res: Response): boolean {
  if (!(err instanceof SteveCorrectionError)) return false;
  const status =
    err.code === 'STALE_REVISION' || err.code === 'RETAKE_IN_PROGRESS'
      ? 409
      : err.code === 'INVALID_TARGET' || err.code === 'INVALID_REPLACEMENT'
        ? 400
        : err.code === 'NO_PROFILE'
          ? 404
          : 500;
  res.status(status).json({
    ok: false,
    error:
      status === 409
        ? 'Your Steve profile changed. Reload before correcting it.'
        : status === 400
          ? 'The Steve correction request is invalid.'
          : status === 404
            ? 'Steve correction is unavailable.'
            : 'Steve correction failed.',
    code:
      status === 409
        ? 'STALE_STEVE_CORRECTION'
        : status === 400
          ? 'INVALID_STEVE_CORRECTION'
          : status === 404
            ? 'STEVE_CORRECTION_UNAVAILABLE'
            : 'STEVE_CORRECTION_FAILED',
  });
  return true;
}

function handleSteveVersioningError(err: unknown, res: Response): boolean {
  if (!(err instanceof SteveVersioningError)) return false;
  const status = err.code === 'NO_PROFILE' ? 404 : 500;
  res.status(status).json({
    ok: false,
    error:
      status === 404
        ? 'A completed Steve profile is required before a retake.'
        : 'Steve retake could not start.',
    code:
      status === 404 ? 'STEVE_PROFILE_REQUIRED' : 'STEVE_RETAKE_FAILED',
  });
  return true;
}

/** Worker-only secret guard for ingest/system-prompt endpoints. Safe-by-default:
 *  if STEVE_WORKER_SECRET is unset (dev), the route returns 503 rather than
 *  letting anyone write artifacts — same posture as requireMichaelWorker. */
function requireSteveWorker(req: Request, res: Response): boolean {
  const expected = process.env.STEVE_WORKER_SECRET;
  if (!expected) {
    res.status(503).json({
      ok: false,
      error: 'STEVE_WORKER_SECRET unset; ingest endpoint disabled.',
    });
    return false;
  }
  const presented = req.header('x-steve-worker-secret');
  if (!presented || presented !== expected) {
    res.status(401).json({ ok: false, error: 'Invalid worker secret.' });
    return false;
  }
  return true;
}

/** GET /api/steve/discovery/state — the BA's own discovery view (self-read). */
steveRoutes.get(
  '/discovery/state',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    markPrivate(res);
    try {
      const view = await buildDiscoveryView(session.tmagId);
      res.json({ ok: true, view });
    } catch (err) {
      res.status(500).json({ ok: false, error: 'Could not load discovery state.' });
    }
  },
);

/** GET /api/steve/discovery/script — the discovery backbone (read-only). */
steveRoutes.get(
  '/discovery/script',
  requireAuth,
  (_req: Request, res: Response) => {
    res.json({ ok: true, sections: STEVE_DISCOVERY_SECTIONS });
  },
);

/** GET /api/steve/discovery/privacy — BA-owned current privacy state. */
steveRoutes.get(
  '/discovery/privacy',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    try {
      const state = await getStevePrivacyState(req.session!.tmagId);
      res.json(privacyResponse(state));
    } catch (err) {
      if (handleStevePrivacyError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Steve privacy read failed.' });
    }
  },
);

/** GET /api/steve/discovery/export — one BA-owned structured export. */
steveRoutes.get(
  '/discovery/export',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    try {
      const exported = await exportStevePrivateRecord(req.session!.tmagId);
      const safeId = req.session!.tmagId.replace(/[^A-Za-z0-9_-]/g, '_');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="steve-success-profile-${safeId}.json"`,
      );
      res.json({ ok: true, ...exported });
    } catch (err) {
      if (handleStevePrivacyError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Steve export failed.' });
    }
  },
);

const SponsorConsentBody = z.object({
  field: z.enum(MCS_STEVE_SPONSOR_CONSENT_FIELDS),
  granted: z.boolean(),
});

/** PUT /api/steve/discovery/privacy/consent — one exact field grant/revoke. */
steveRoutes.put(
  '/discovery/privacy/consent',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    const parsed = SponsorConsentBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid sponsor-consent request.' });
      return;
    }
    try {
      const result = await setSteveSponsorConsent({
        tmagId: req.session!.tmagId,
        field: parsed.data.field,
        granted: parsed.data.granted,
      });
      res.json({
        ...privacyResponse(result),
        auditEntryId: result.auditEntryId,
      });
    } catch (err) {
      if (handleStevePrivacyError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Sponsor-consent update failed.' });
    }
  },
);

const WithdrawBody = z.object({
  confirmation: z.literal(MCS_STEVE_WITHDRAW_CONFIRMATION),
});

const CorrectionTarget = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('transcript_text'),
    sequence: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal('answer_text'),
    questionId: z.string().trim().min(1).max(160),
  }),
  z.object({
    kind: z.literal('profile_text'),
    path: z.enum(MCS_STEVE_CORRECTABLE_PROFILE_TEXT_FIELDS),
  }),
  z.object({
    kind: z.literal('profile_list'),
    path: z.enum(MCS_STEVE_CORRECTABLE_PROFILE_LIST_FIELDS),
  }),
  z.object({
    kind: z.literal('recommendation_text'),
    list: z.enum(['launch', 'training']),
    index: z.number().int().nonnegative().max(100),
  }),
]);

const CorrectionBody = z.object({
  target: CorrectionTarget,
  replacement: z.union([
    z.string().max(4_000),
    z.array(z.string().max(200)).max(20),
  ]),
  expectedRevision: z.number().int().nonnegative(),
  confirmation: z.literal(MCS_STEVE_CORRECTION_CONFIRMATION),
});

/** PUT /api/steve/discovery/correction — replace one BA-owned private value. */
steveRoutes.put(
  '/discovery/correction',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    const parsed = CorrectionBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Correction confirmation and one valid replacement are required.',
      });
      return;
    }
    try {
      const result = await correctStevePrivateRecord({
        tmagId: req.session!.tmagId,
        payload: parsed.data,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      if (handleSteveCorrectionError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Steve correction failed.' });
    }
  },
);

const RetakeBody = z.object({
  confirmation: z.literal(MCS_STEVE_RETAKE_CONFIRMATION),
});

/** POST /api/steve/discovery/retake — begin a versioned BA-owned retake.
 *  The current completed profile remains active until the replacement is
 *  complete; no ordinary deletion endpoint exists. */
steveRoutes.post(
  '/discovery/retake',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    const parsed = RetakeBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Retake confirmation is required.',
      });
      return;
    }
    try {
      const result = await startSteveRetake(req.session!.tmagId);
      res.json({
        ok: true,
        retakeSessionId: result.retakeSession.sessionId,
        profileVersion: result.profileVersion,
        startedAt: result.retakeSession.startedAt,
        auditEntryId: result.auditEntryId,
      });
    } catch (err) {
      if (handleSteveVersioningError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Steve retake could not start.' });
    }
  },
);

/** POST /api/steve/discovery/privacy/withdraw — stop personalization/sharing. */
steveRoutes.post(
  '/discovery/privacy/withdraw',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    markPrivate(res);
    const parsed = WithdrawBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Withdrawal confirmation required.' });
      return;
    }
    try {
      const result = await withdrawStevePersonalization(req.session!.tmagId);
      res.json({
        ...privacyResponse(result),
        auditEntryId: result.auditEntryId,
      });
    } catch (err) {
      if (handleStevePrivacyError(err, res)) return;
      res.status(500).json({ ok: false, error: 'Steve withdrawal failed.' });
    }
  },
);

/** GET /api/steve/discovery/system-prompt?tmagId=... — worker → server.
 *  Returns the resolved Steve system prompt for the external voice worker.
 *  Always 200 with a non-empty system string (buildSteveSystemPrompt is
 *  self-contained and never throws). */
steveRoutes.get(
  '/discovery/system-prompt',
  async (req: Request, res: Response) => {
    if (!requireSteveWorker(req, res)) return;
    markPrivate(res);

    const tmagId = typeof req.query.tmagId === 'string' ? req.query.tmagId.trim() : '';
    if (!tmagId) {
      res.status(400).json({ ok: false, error: 'Provide tmagId.' });
      return;
    }

    // Best-effort first-name lookup. A blank/missing name degrades to a neutral
    // greeting rather than blocking the call.
    let firstName = '';
    try {
      const baLookup = await persistenceCall<{ documents: { firstName?: string }[] }>(
        'mongodb',
        'query',
        {
          database: 'momentum',
          collection: 'team_magnificent_members',
          filter: { tmagId },
          projection: { firstName: 1 },
          limit: 1,
        },
      );
      firstName = baLookup.documents[0]?.firstName?.trim() ?? '';
    } catch {
      firstName = '';
    }

    const system = buildSteveSystemPrompt({ baFirstName: firstName || 'there' });
    res.json({ ok: true, tmagId, system });
  },
);

/** POST /api/steve/discovery/ingest — worker → server. Persists the completed
 *  discovery artifact. Triple-stacked; sponsorTmagId server-stamped. */
const Recommendation = z.object({
  text: z.string(),
  href: z.string().nullable().optional(),
});

const IngestBody = z.object({
  tmagId: z.string().min(1),
  callSid: z.string().nullable(),
  startedAt: z.string().min(10),
  completedAt: z.string().min(10),
  transcript: z.array(
    z.object({
      sequence: z.number(),
      speaker: z.enum(['steve', 'ba']),
      text: z.string(),
      occurredAt: z.string(),
    }),
  ).max(250),
  answers: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      answerText: z.string(),
    }),
  ).max(100),
  audioUrl: z.string().nullable(),
  profile: z.object({
    primaryWhy: z.object({
      statement: z.string(),
      who: z.string(),
      whyNow: z.string(),
    }),
    successVision: z.object({
      statement: z.string(),
      oneBigChange: z.string(),
    }),
    learningStyle: z.object({
      modalities: z.array(
        z.enum(['watching', 'doing', 'step_by_step', 'reading', 'discussing', 'mixed']),
      ).max(6),
      feedbackPreference: z.string(),
      notes: z.string(),
    }),
    communicationPreferences: z.object({
      preferredChannels: z.array(
        z.enum(['text', 'call', 'email', 'in_app', 'video', 'in_person']),
      ).max(6),
      cadence: z.enum(['daily', 'few_times_week', 'weekly', 'as_needed']).nullable(),
      bestTimes: z.string(),
      notes: z.string(),
    }),
    supportNeeds: z.object({
      areas: z.array(z.string()).max(50),
      potentialObstacles: z.array(z.string()).max(50),
      helpStyle: z.string(),
      notes: z.string(),
    }),
    launchRecommendations: z.array(Recommendation).max(50),
    trainingRecommendations: z.array(Recommendation).max(50),
    michaelHandoffSummary: z.string(),
  }),
});

steveRoutes.post(
  '/discovery/ingest',
  async (req: Request, res: Response) => {
    if (!requireSteveWorker(req, res)) return;
    markPrivate(res);
    const parsed = IngestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        ok: false,
        error: 'Invalid discovery payload.',
        details: parsed.error.flatten(),
      });
      return;
    }
    try {
      // Normalize optional href to null so the stored shape is stable.
      const data = parsed.data;
      const normalizeRecs = (recs: Array<{ text: string; href?: string | null }>) =>
        recs.map((r) => ({ text: r.text, href: r.href ?? null }));
      const artifact = await ingestDiscoveryArtifact({
        tmagId: data.tmagId,
        callSid: data.callSid,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        transcript: data.transcript,
        answers: data.answers,
        audioUrl: data.audioUrl,
        profile: {
          ...data.profile,
          launchRecommendations: normalizeRecs(data.profile.launchRecommendations),
          trainingRecommendations: normalizeRecs(data.profile.trainingRecommendations),
        },
      });
      // eslint-disable-next-line no-console
      console.log(
        `[audit] steve_discovery_ingested discoveryId=SD-${artifact.tmagId} ` +
          `answers=${artifact.answers.length}`,
      );
      res.json({
        ok: true,
        receipt: {
          discoveryId: `SD-${artifact.tmagId}`,
          tmagId: artifact.tmagId,
          completedAt: artifact.completedAt,
          signedBy: artifact.successProfile.signedBy,
        },
      });
    } catch (err) {
      if (err instanceof DiscoveryIngestError) {
        const status =
          err.code === 'NO_BA' ? 400 : err.code === 'ALREADY_EXISTS' ? 409 : 500;
        res.status(status).json({
          ok: false,
          error:
            status === 400
              ? 'No matching BA record.'
              : status === 409
                ? 'Discovery already exists.'
                : 'Discovery ingest failed.',
          code: err.code,
        });
        return;
      }
      res.status(500).json({ ok: false, error: 'Discovery ingest failed.' });
    }
  },
);

/** GET /api/steve/discovery/profile/:downlineTmagId — legacy raw sponsor route.
 *  ACR-0031 keeps it fail-closed; all access/not-found/consent failures return
 *  one opaque 404. */
steveRoutes.get(
  '/discovery/profile/:downlineTmagId',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    const session = req.session!;
    markPrivate(res);
    const downlineTmagId = String(req.params.downlineTmagId ?? '');
    if (!downlineTmagId) {
      res.status(400).json({ ok: false, error: 'Missing downlineTmagId.' });
      return;
    }
    try {
      const card = await getProfileCardForSponsor({
        requestingTmagId: session.tmagId,
        downlineTmagId,
      });
      res.json({ ok: true, card });
    } catch (err) {
      if (err instanceof SponsorAccessError) {
        res.status(404).json({
          ok: false,
          error: 'Profile unavailable.',
          code: 'PROFILE_UNAVAILABLE',
        });
        return;
      }
      res.status(500).json({ ok: false, error: 'Profile read failed.' });
    }
  },
);

/** GET /api/steve/discovery/conversation — the BA's own LIVE chat transcript
 *  (in-flight interview state; the completed artifact lives in /state). */
steveRoutes.get('/discovery/conversation', requireAuth, async (req: Request, res: Response) => {
  markPrivate(res);
  try {
    const turns = await loadConversation(req.session!.tmagId);
    res.json({ ok: true, turns });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Conversation read failed.' });
  }
});

const ConverseBody = z.object({ message: z.string().max(4000).optional().default('') });

/** POST /api/steve/discovery/converse — one turn of the browser-based
 *  discovery interview (amended locked spec S1.6: the dashboard carries
 *  conversations). Empty message = open/greet. done=true once the artifact
 *  has been ingested (gate opens). */
steveRoutes.post('/discovery/converse', requireAuth, async (req: Request, res: Response) => {
  markPrivate(res);
  const parsed = ConverseBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid body.' });
    return;
  }
  try {
    const result = await converseWithSteve(req.session!.tmagId, parsed.data.message);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof SteveAlreadyCompleteError) {
      res.status(409).json({ ok: false, error: 'Discovery already complete.', code: 'ALREADY_COMPLETE' });
      return;
    }
    if (err instanceof AnthropicConfigError) {
      res.status(503).json({ ok: false, error: 'Steve is not configured on this environment yet.', code: 'LLM_DORMANT' });
      return;
    }
    res.status(500).json({ ok: false, error: 'Steve conversation failed.' });
  }
});
