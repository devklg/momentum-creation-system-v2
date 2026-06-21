/**
 * /api/steve/* — Steve New BA Discovery & Success Interview routes (SEPARATE
 * agent; does NOT touch Michael's schedule/interview/scoring flow).
 *
 * BA self-reads:
 *   GET  /api/steve/discovery/state   → the BA's own discovery view
 *   GET  /api/steve/discovery/script  → the discovery backbone (read-only ref)
 *
 * Worker ↔ server (machine-to-machine, STEVE_WORKER_SECRET guarded):
 *   GET  /api/steve/discovery/system-prompt?baId=...  → system prompt string
 *   POST /api/steve/discovery/ingest                  → persist the artifact
 *
 * Sponsor-only:
 *   GET  /api/steve/discovery/profile/:downlineBaId   → downline's profile card
 *
 * Compliance: BA-facing only, never prospect-facing, never on .com. No income
 * or placement language anywhere (locked-spec 3.10/3.12). Steve never scores or
 * judges — the artifact carries the BA's own words.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireMichaelComplete } from '../middleware/requireMichaelComplete.js';
import {
  STEVE_DISCOVERY_SECTIONS,
  buildSteveSystemPrompt,
  buildDiscoveryView,
  ingestDiscoveryArtifact,
  getProfileCardForSponsor,
  DiscoveryIngestError,
  SponsorAccessError,
} from '../domain/steve-success-interview.js';
import { gatewayCall } from '../services/gateway.js';

export const steveRoutes: Router = express.Router();

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
    try {
      const view = await buildDiscoveryView(session.baId);
      res.json({ ok: true, view });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Could not load discovery state: ${msg}` });
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

/** GET /api/steve/discovery/system-prompt?baId=... — worker → server.
 *  Returns the resolved Steve system prompt for the external voice worker.
 *  Always 200 with a non-empty system string (buildSteveSystemPrompt is
 *  self-contained and never throws). */
steveRoutes.get(
  '/discovery/system-prompt',
  async (req: Request, res: Response) => {
    if (!requireSteveWorker(req, res)) return;

    const baId = typeof req.query.baId === 'string' ? req.query.baId.trim() : '';
    if (!baId) {
      res.status(400).json({ ok: false, error: 'Provide baId.' });
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

    const system = buildSteveSystemPrompt({ baFirstName: firstName || 'there' });
    res.json({ ok: true, baId, system });
  },
);

/** POST /api/steve/discovery/ingest — worker → server. Persists the completed
 *  discovery artifact. Triple-stacked; sponsorBaId server-stamped. */
const Recommendation = z.object({
  text: z.string(),
  href: z.string().nullable().optional(),
});

const IngestBody = z.object({
  baId: z.string().min(1),
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
  ),
  answers: z.array(
    z.object({
      questionId: z.string(),
      prompt: z.string(),
      answerText: z.string(),
    }),
  ),
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
      ),
      feedbackPreference: z.string(),
      notes: z.string(),
    }),
    communicationPreferences: z.object({
      preferredChannels: z.array(
        z.enum(['text', 'call', 'email', 'in_app', 'video', 'in_person']),
      ),
      cadence: z.enum(['daily', 'few_times_week', 'weekly', 'as_needed']).nullable(),
      bestTimes: z.string(),
      notes: z.string(),
    }),
    supportNeeds: z.object({
      areas: z.array(z.string()),
      potentialObstacles: z.array(z.string()),
      helpStyle: z.string(),
      notes: z.string(),
    }),
    launchRecommendations: z.array(Recommendation),
    trainingRecommendations: z.array(Recommendation),
    michaelHandoffSummary: z.string(),
  }),
});

steveRoutes.post(
  '/discovery/ingest',
  async (req: Request, res: Response) => {
    if (!requireSteveWorker(req, res)) return;
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
        baId: data.baId,
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
        `[audit] steve_discovery_ingested baId=${artifact.baId} sponsor=${
          artifact.sponsorBaId ?? 'none'
        } answers=${artifact.answers.length}`,
      );
      res.json({ ok: true, artifact });
    } catch (err) {
      if (err instanceof DiscoveryIngestError) {
        const status = err.code === 'NO_BA' ? 400 : 500;
        res.status(status).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Discovery ingest failed: ${msg}` });
    }
  },
);

/** GET /api/steve/discovery/profile/:downlineBaId — sponsor-only.
 *  The direct sponsor reads a downline's Steve Success Profile. Authoritative
 *  check is server-side; 403 if not the direct sponsor. */
steveRoutes.get(
  '/discovery/profile/:downlineBaId',
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
      const card = await getProfileCardForSponsor({
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
      res.status(500).json({ ok: false, error: `Profile read failed: ${msg}` });
    }
  },
);
