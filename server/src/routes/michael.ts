/**
 * /api/michael/* — BA-facing schedule routes.
 *
 * GET  /api/michael/slots   → list available 15-min slots in BA's TZ
 * POST /api/michael/book    → lock a chosen slot
 * GET  /api/michael/status  → current schedule record for this BA
 *
 * All routes require an authenticated session (requireAuth).
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  MICHAEL_INTERVIEW_SECTIONS,
  buildMichaelSystemPrompt,
} from '../domain/michael-interview-script.js';
import { listFounderHandoffs } from '../domain/michael-founder-handoff.js';
import {
  bookMichaelSlot,
  generateSlots,
  getMichaelSchedule,
  BookingError,
} from '../domain/michael-schedule.js';
import {
  appendTranscriptChunk,
  buildInterviewView,
  flagSttFailure,
  flagWrongNumber,
  getCockpitCardForSponsor,
  getTranscriptChunks,
  ingestInterviewArtifact,
  ScoringIngestError,
  SponsorAccessError,
} from '../domain/michaelScoring.js';
import {
  subscribeChunksForCall,
  subscribePhaseForBa,
} from '../services/michaelEvents.js';
import {
  getTrainingSupportCardForSponsor,
  TrainingSupportAccessError,
} from '../domain/michael-training-support.js';

export const michaelRoutes: Router = express.Router();

michaelRoutes.get('/slots', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  const schedule = await getMichaelSchedule(session.baId);
  if (!schedule) {
    res.status(404).json({ ok: false, error: 'No Michael schedule for this BA.' });
    return;
  }
  if (!schedule.timezone) {
    res.status(400).json({ ok: false, error: 'BA timezone missing. Update profile first.' });
    return;
  }
  const slots = generateSlots({
    signupAt: new Date(schedule.signupAt),
    timezone: schedule.timezone,
  });
  res.json({
    ok: true,
    timezone: schedule.timezone,
    status: schedule.status,
    slotStartUtc: schedule.slotStartUtc,
    rescheduleCount: schedule.rescheduleCount,
    slots,
  });
});

const BookBody = z.object({
  slotStartUtc: z.string().min(20).max(40),
});

michaelRoutes.post('/book', requireAuth, async (req: Request, res: Response) => {
  const parsed = BookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
    return;
  }
  const session = req.session!;
  try {
    const schedule = await bookMichaelSlot({
      baId: session.baId,
      slotStartUtc: parsed.data.slotStartUtc,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[audit] michael_slot_booked baId=${session.baId} slot=${schedule.slotStartUtc} rescheduleCount=${schedule.rescheduleCount}`,
    );
    res.json({ ok: true, schedule });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(400).json({ ok: false, error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Booking failed: ${msg}` });
  }
});

michaelRoutes.get('/status', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  const schedule = await getMichaelSchedule(session.baId);
  if (!schedule) {
    res.status(404).json({ ok: false, error: 'No Michael schedule for this BA.' });
    return;
  }
  res.json({ ok: true, schedule });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chat #134 — Michael interview surface (wireframe §3.2 leaves wf_0038-0042)
// Extends the schedule routes above with the post-scheduling, during/after-call
// surface. Mounted under the same /api/michael prefix; pre-Michael whitelisted
// (a brand-new BA must reach these BEFORE the gate opens — they are how the
// gate gets opened). The /cockpit subroute is the one exception — sponsors
// reading downline interviews are post-Michael by definition.
// ─────────────────────────────────────────────────────────────────────────────

/** Worker-only secret guard for transcript/scoring ingest endpoints. The
 *  scoring + STT workers POST here machine-to-machine. If MICHAEL_WORKER_SECRET
 *  is unset (dev), the route returns 503 rather than silently allowing anyone
 *  to write transcripts — safe-by-default consistent with the wired-dormant
 *  pattern for Resend/Anthropic surfaces (CLAUDE.md). */
function requireMichaelWorker(req: Request, res: Response): boolean {
  const expected = process.env.MICHAEL_WORKER_SECRET;
  if (!expected) {
    res.status(503).json({
      ok: false,
      error: 'MICHAEL_WORKER_SECRET unset; ingest endpoint disabled.',
    });
    return false;
  }
  const presented = req.header('x-michael-worker-secret');
  if (!presented || presented !== expected) {
    res.status(401).json({ ok: false, error: 'Invalid worker secret.' });
    return false;
  }
  return true;
}

/** GET /api/michael/interview/state — BA's own interview view (self-read). */
michaelRoutes.get(
  '/interview/state',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    const view = await buildInterviewView(session.baId);
    if (!view) {
      res
        .status(404)
        .json({ ok: false, error: 'No Michael schedule for this BA.' });
      return;
    }
    res.json({ ok: true, view });
  },
);

/** POST /api/michael/interview/wrong-number — wf_0038 wrong-number link.
 *  Flags the schedule and writes an admin audit; the BA sees a confirmation. */
michaelRoutes.post(
  '/interview/wrong-number',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    const occurredAt = new Date().toISOString();
    try {
      await flagWrongNumber({ baId: session.baId, occurredAt });
      // eslint-disable-next-line no-console
      console.log(
        `[audit] michael_wrong_number_flagged baId=${session.baId} at=${occurredAt}`,
      );
      res.json({ ok: true, flaggedAt: occurredAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Could not flag: ${msg}` });
    }
  },
);

/** GET /api/michael/interview/transcript/stream — wf_0039 SSE.
 *  Streams live transcript chunks for the BA's current call. Hydrates with a
 *  snapshot on connect, then pushes new chunks as STT segments finalize. */
michaelRoutes.get(
  '/interview/transcript/stream',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    const schedule = await getMichaelSchedule(session.baId);
    if (!schedule || !schedule.callSid) {
      res.status(409).json({
        ok: false,
        error: 'No active call for this BA. Open the interview page when the call starts.',
      });
      return;
    }

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const send = (data: Record<string, unknown>): void => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Hydrate
    const snapshotChunks = await getTranscriptChunks(schedule.callSid);
    const initialPhase = await buildInterviewView(session.baId);
    send({
      type: 'snapshot',
      chunks: snapshotChunks,
      phase: initialPhase?.phase ?? 'awaiting_call',
    });

    const chunkSub = subscribeChunksForCall(schedule.callSid, (chunk) => {
      send({ type: 'chunk', chunk });
    });
    const phaseSub = subscribePhaseForBa(session.baId, (phase) => {
      send({ type: 'phase', phase });
    });

    const heartbeat = setInterval(() => {
      send({ type: 'heartbeat' });
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      chunkSub.unsubscribe();
      phaseSub.unsubscribe();
      res.end();
    });
  },
);

/** POST /api/michael/interview/transcript/chunk — worker → server.
 *  STT pipeline pushes finalized chunks during the call. Worker-secret guarded. */
const ChunkBody = z.object({
  callSid: z.string().min(1),
  chunk: z.object({
    speaker: z.enum(['michael', 'ba']),
    text: z.string().min(1),
    occurredAt: z.string().min(10),
  }),
});

michaelRoutes.post(
  '/interview/transcript/chunk',
  async (req: Request, res: Response) => {
    if (!requireMichaelWorker(req, res)) return;
    const parsed = ChunkBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid chunk payload.' });
      return;
    }
    // Resolve baId from the schedule keyed by callSid — workers don't get to
    // assert baId; the server owns that binding.
    const { gatewayCall } = await import('../services/gateway.js');
    const lookup = await gatewayCall<{ documents: { baId: string }[] }>(
      'mongodb',
      'query',
      {
        database: 'momentum',
        collection: 'michael_schedules',
        filter: { callSid: parsed.data.callSid },
        limit: 1,
      },
    );
    const baId = lookup.documents[0]?.baId ?? null;
    if (!baId) {
      res.status(404).json({
        ok: false,
        error: `No schedule bound to callSid=${parsed.data.callSid}.`,
      });
      return;
    }
    try {
      const result = await appendTranscriptChunk({
        callSid: parsed.data.callSid,
        baId,
        chunk: parsed.data.chunk,
      });
      res.json({ ok: true, sequence: result.sequence });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Chunk write failed: ${msg}` });
    }
  },
);

/** POST /api/michael/interview/scoring — worker → server.
 *  Final Training Agent + Daily Success Coach artifact ingest. Route name is retained for worker
 *  compatibility, but Michael no longer scores or classifies BAs. Any
 *  categoryScores supplied by an older worker are ignored by the domain. */
const ScoringBody = z.object({
  baId: z.string().min(1),
  callSid: z.string().min(1),
  startedAt: z.string().min(10),
  completedAt: z.string().min(10),
  transcript: z.array(
    z.object({
      sequence: z.number(),
      speaker: z.enum(['michael', 'ba']),
      text: z.string(),
      occurredAt: z.string(),
    }),
  ),
  answers: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      answerText: z.string(),
      scoringTags: z.array(z.string()),
    }),
  ),
  scoring: z.object({
    overallTone: z.enum(['positive', 'neutral', 'guarded']).nullable(),
    highlightTags: z.array(z.string()),
    signedBy: z.string(),
  }),
  audioUrl: z.string().nullable(),
  // Legacy worker compatibility only. Current architecture ignores this field:
  // Steve discovers context without scoring, and Michael coaches launch.
  categoryScores: z
    .object({
      vision: z.number(),
      commitment: z.number(),
      coachability: z.number(),
      availableTime: z.number(),
      network: z.number(),
      experience: z.number(),
    })
    .optional(),
});

michaelRoutes.post(
  '/interview/scoring',
  async (req: Request, res: Response) => {
    if (!requireMichaelWorker(req, res)) return;
    const parsed = ScoringBody.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ ok: false, error: 'Invalid scoring payload.', details: parsed.error.flatten() });
      return;
    }
    try {
      const { categoryScores, ...payload } = parsed.data;
      const artifact = await ingestInterviewArtifact(payload, categoryScores);
      // eslint-disable-next-line no-console
      console.log(
        `[audit] michael_artifact_ingested baId=${artifact.baId} sponsor=${artifact.sponsorBaId ?? 'none'} answers=${artifact.answers.length} classification=retired`,
      );
      res.json({ ok: true, artifact });
    } catch (err) {
      if (err instanceof ScoringIngestError) {
        res.status(400).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Scoring ingest failed: ${msg}` });
    }
  },
);

/** POST /api/michael/interview/stt-fail — worker → server.
 *  Worker flags an STT pipeline failure so the surface renders the audio-only
 *  fallback (wf_0041). The audio recording remains accessible to the BA. */
const SttFailBody = z.object({
  baId: z.string().min(1),
  reason: z.string().min(1),
});

michaelRoutes.post(
  '/interview/stt-fail',
  async (req: Request, res: Response) => {
    if (!requireMichaelWorker(req, res)) return;
    const parsed = SttFailBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid stt-fail payload.' });
      return;
    }
    try {
      await flagSttFailure({
        baId: parsed.data.baId,
        occurredAt: new Date().toISOString(),
        reason: parsed.data.reason,
      });
      res.json({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `STT-fail flag failed: ${msg}` });
    }
  },
);

/** GET /api/michael/interview/cockpit/:downlineBaId — wf_0042 sponsor-only.
 *  Sponsor reads the downline's interview card. Authoritative check is
 *  server-side via getCockpitCardForSponsor; 403 if not the direct sponsor. */
michaelRoutes.get(
  '/interview/cockpit/:downlineBaId',
  requireAuth,
  requireMichaelComplete,
  async (req: Request, res: Response) => {
    const session = req.session!;
    const downlineBaId = String(req.params.downlineBaId ?? '');
    if (!downlineBaId) {
      res.status(400).json({ ok: false, error: 'Missing downlineBaId.' });
      return;
    }
    try {
      const card = await getCockpitCardForSponsor({
        requestingBaId: session.baId,
        downlineBaId,
      });
      res.json({ ok: true, card });
    } catch (err) {
      if (err instanceof SponsorAccessError) {
        const status = err.code === 'NOT_SPONSOR' ? 403 : 404;
        res.status(status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Cockpit read failed: ${msg}` });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Michael Training Agent + Daily Success Coach content + legacy founder handoff read.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/michael/interview/script — Michael's guided Training Agent + Daily Success Coach backbone.
 *  Read-only reference for the BA-facing surface (what Michael covers) and for
 *  debugging. Auth-only; the script is BA-facing content, never prospect-facing.
 *  No rubric or classification bands are served. */
michaelRoutes.get(
  '/interview/script',
  requireAuth,
  (_req: Request, res: Response) => {
    res.json({
      ok: true,
      sections: MICHAEL_INTERVIEW_SECTIONS,
      philosophy:
        'Michael is the Training Agent and Daily Success Coach. Steve owns discovery and Success Profile. Michael does not score, rank, or classify.',
    });
  },
);

/** GET /api/michael/interview/founder-handoffs — founders-only legacy read.
 *  Kept so historical handoff records remain visible. New Michael ingests do
 *  not create classified founder handoffs. */
michaelRoutes.get(
  '/interview/founder-handoffs',
  requireAdmin,
  async (_req: Request, res: Response) => {
    try {
      const handoffs = await listFounderHandoffs();
      res.json({ ok: true, handoffs });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Handoff read failed: ${msg}` });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Chat #147 — inherit-michael (F.5 master-content inheritance, Wave 2)
//
// The Michael voice model call runs in the EXTERNAL STT→LLM→TTS worker (the same
// worker that pushes transcript chunks + scoring back to the guarded endpoints
// above). For the master-content-resolved interview prompt to ACTUALLY reach
// that model call, the server must SERVE it: this endpoint returns the system
// prompt built by buildMichaelSystemPrompt(), whose FRAMING line is resolved
// through readMasterContent('team.michael.interview_prompts') — override-else-
// code-default, interpolated server-side. Saving a master override changes the
// served prompt immediately; the 29-Q backbone stays code-owned.
//
// Worker-secret guarded (same x-michael-worker-secret as the ingest endpoints).
// The worker fetches this once at call start and passes `system` to its model.
//
// RESILIENCE: readMasterContent never throws (it degrades to the code default on
// any gateway/Mongo hiccup), and a missing BA first name degrades to a neutral
// greeting — so this always returns 200 with a NON-EMPTY system string. Michael
// must never start a call with an empty prompt.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/michael/interview/system-prompt?callSid=...|baId=... — worker → server.
 *  Returns the resolved Michael interview system prompt for the external voice
 *  worker's model call. Bind by callSid (worker knows it from Telnyx) with a
 *  baId fallback. */
michaelRoutes.get(
  '/interview/system-prompt',
  async (req: Request, res: Response) => {
    if (!requireMichaelWorker(req, res)) return;

    const callSid =
      typeof req.query.callSid === 'string' ? req.query.callSid.trim() : '';
    const baIdParam =
      typeof req.query.baId === 'string' ? req.query.baId.trim() : '';
    if (!callSid && !baIdParam) {
      res
        .status(400)
        .json({ ok: false, error: 'Provide callSid or baId.' });
      return;
    }

    // Resolve the BA (and their first name) the server owns the binding — the
    // worker never asserts baId when a callSid is given.
    const { gatewayCall } = await import('../services/gateway.js');
    let baId = baIdParam || null;
    if (!baId && callSid) {
      const lookup = await gatewayCall<{ documents: { baId: string }[] }>(
        'mongodb',
        'query',
        {
          database: 'momentum',
          collection: 'michael_schedules',
          filter: { callSid },
          limit: 1,
        },
      );
      baId = lookup.documents[0]?.baId ?? null;
    }
    if (!baId) {
      res.status(404).json({
        ok: false,
        error: `No schedule bound to callSid=${callSid}.`,
      });
      return;
    }

    // Best-effort first-name lookup. A blank/missing name degrades to a neutral
    // greeting rather than blocking the call.
    let firstName = '';
    try {
      const baLookup = await gatewayCall<{ documents: { firstName?: string }[] }>(
        'mongodb',
        'query',
        {
          database: 'momentum',
          collection: 'brand_ambassadors',
          filter: { baId },
          limit: 1,
        },
      );
      firstName = baLookup.documents[0]?.firstName?.trim() ?? '';
    } catch {
      firstName = '';
    }

    // buildMichaelSystemPrompt resolves team.michael.interview_prompts via
    // readMasterContent (override-else-code-default, never throws) and folds it
    // into the system prompt. This is the resolved string the model sees.
    const system = await buildMichaelSystemPrompt({
      baFirstName: firstName || 'there',
    });
    res.json({ ok: true, baId, system });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// feature/michael-training-support — sponsor-facing training support card.
// Projects Steve's already-persisted SuccessProfile (steve_discoveries) into
// "how to support this downline's training" guidance for the direct sponsor.
// READ-ONLY; no new collection. Sibling to /interview/cockpit/:downlineBaId.
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/michael/training-support/:downlineBaId — sponsor-only.
 *  Sponsor reads the downline's derived training-support card. Authoritative
 *  check is server-side via getTrainingSupportCardForSponsor; 403 if not the
 *  direct sponsor, 404 if no downline or no Steve discovery yet. */
michaelRoutes.get(
  '/training-support/:downlineBaId',
  requireAuth,
  requireMichaelComplete,
  async (req: Request, res: Response) => {
    const session = req.session!;
    const downlineBaId = String(req.params.downlineBaId ?? '');
    if (!downlineBaId) {
      res.status(400).json({ ok: false, error: 'Missing downlineBaId.' });
      return;
    }
    try {
      const card = await getTrainingSupportCardForSponsor({
        requestingBaId: session.baId,
        downlineBaId,
      });
      res.json({ ok: true, card });
    } catch (err) {
      if (err instanceof TrainingSupportAccessError) {
        const status = err.code === 'NOT_SPONSOR' ? 403 : 404;
        res.status(status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Training-support read failed: ${msg}` });
    }
  },
);
