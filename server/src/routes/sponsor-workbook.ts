/**
 * /api/sponsor/workbook routes — sponsor-led BA Interview Workbook.
 *
 * Three endpoints:
 *   GET    /:tmagId           - Returns the workbook (creates draft if absent)
 *                             AND the BA's questionnaire for context.
 *   PUT    /:tmagId/draft     - Incremental autosave. Mongo-only, no triple-stack.
 *   POST   /:tmagId/finalize  - Irrevocable. Triple-stack write. Requires
 *                             classification + first actions.
 *
 * Authorization: requireAuth + the session's tmagId must equal the target BA's
 * sponsorTmagId (canConductWorkbook). Admins from ADMIN_BA_IDS bypass the
 * sponsor check — allowed for any BA. Anyone else gets 403.
 *
 * Per Chat #22 / Chat #103 architecture: this is the 30-45 min partnership
 * conversation the sponsor runs after the BA submits the questionnaire.
 */

import express, {
  type Request,
  type Response,
  type Router,
} from 'express';
import { env } from '../env.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { findBAByTmagId } from '../domain/ba.js';
import {
  canConductWorkbook,
  createWorkbookDraft,
  finalizeWorkbook,
  getWorkbook,
  saveWorkbookDraft,
  type Classification,
  type WorkbookNotes,
} from '../domain/workbook.js';
import { getQuestionnaire } from '../domain/questionnaire.js';

export const sponsorWorkbookRoutes: Router = express.Router();

function isAdmin(session: { tmagId: string; threeBaId: string }): boolean {
  return (
    env.ADMIN_BA_IDS.includes(session.threeBaId) ||
    env.ADMIN_BA_IDS.includes(session.tmagId)
  );
}

async function authorizeSponsor(
  req: Request,
  res: Response,
  forTmagId: string,
): Promise<boolean> {
  const session = req.session!;
  if (isAdmin(session)) return true;
  const allowed = await canConductWorkbook({
    sponsorTmagId: session.tmagId,
    forTmagId,
  });
  if (!allowed) {
    res.status(403).json({
      ok: false,
      error:
        'You are not the sponsor of record for this BA. Workbook is restricted to the direct sponsor.',
    });
  }
  return allowed;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /:tmagId
// Returns:
//   - workbook (draft auto-created if absent)
//   - questionnaire (so the sponsor has context to run the call)
//   - ba (basic identity)
// ──────────────────────────────────────────────────────────────────────────────
sponsorWorkbookRoutes.get(
  '/:tmagId',
  requireAuth,
  async (req: Request, res: Response) => {
    const rawTmagId = req.params.tmagId;
    const forTmagId = typeof rawTmagId === 'string' ? rawTmagId : '';
    if (!forTmagId) {
      res.status(400).json({ ok: false, error: 'tmagId path param required.' });
      return;
    }
    if (!(await authorizeSponsor(req, res, forTmagId))) return;

    try {
      const ba = await findBAByTmagId(forTmagId);
      if (!ba) {
        res.status(404).json({ ok: false, error: 'BA not found.' });
        return;
      }

      let workbook = await getWorkbook(forTmagId);
      if (!workbook) {
        const session = req.session!;
        // Sponsor's own name for the audit trail.
        const sponsor = await findBAByTmagId(session.tmagId);
        const conductedByName = sponsor
          ? `${sponsor.firstName} ${sponsor.lastName}`.trim()
          : 'Unknown Sponsor';
        workbook = await createWorkbookDraft({
          forTmagId,
          forThreeBaId: ba.threeBaId,
          conductedByTmagId: session.tmagId,
          conductedByName,
        });
      }

      const questionnaire = await getQuestionnaire(forTmagId);

      res.json({
        ok: true,
        workbook,
        questionnaire,
        ba: {
          tmagId: ba.tmagId,
          threeBaId: ba.threeBaId,
          firstName: ba.firstName,
          lastName: ba.lastName,
          email: ba.email,
          phone: ba.phone,
          createdAt: ba.createdAt,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Workbook load failed: ${msg}` });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// PUT /:tmagId/draft — incremental autosave
// ──────────────────────────────────────────────────────────────────────────────
const CLASSIFICATIONS: ReadonlyArray<Classification> = ['gogetter', 'consumer'];

function asPartialNotes(input: unknown): Partial<WorkbookNotes> | null {
  if (!input || typeof input !== 'object') return null;
  const allowed: ReadonlyArray<keyof WorkbookNotes> = [
    'q1_biggest_win_followup',
    'q2_why_now_followup',
    'q3_income_goal_first_change',
    'q4_product_experience',
    'q5_best_friend_pitch',
    'q6_product_excitement_1_to_10',
    'q7_pushed_through_completion',
    'q8_falling_behind_response',
    'q9_hours_giving_up',
    'q10_uncomfortable_action_reaction',
    'q11_feedback_acceptance_speed',
    'q12_my_way_vs_their_way',
    'q13_biggest_fear',
    'q14_quitting_pattern',
    'q15_invest_500_reaction',
    'q16_90_days_no_money',
    'q17_dealbreaker_can_we_prevent',
    'q18_contract_agreement',
    'q19_accountability_acceptance',
    'q20_sell_me_on_you',
  ];
  const out: Partial<WorkbookNotes> = {};
  const obj = input as Record<string, unknown>;
  for (const k of allowed) {
    const v = obj[k];
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

sponsorWorkbookRoutes.put(
  '/:tmagId/draft',
  requireAuth,
  async (req: Request, res: Response) => {
    const rawTmagId = req.params.tmagId;
    const forTmagId = typeof rawTmagId === 'string' ? rawTmagId : '';
    if (!forTmagId) {
      res.status(400).json({ ok: false, error: 'tmagId path param required.' });
      return;
    }
    if (!(await authorizeSponsor(req, res, forTmagId))) return;

    try {
      const workbook = await getWorkbook(forTmagId);
      if (!workbook) {
        res
          .status(404)
          .json({ ok: false, error: 'No workbook draft exists yet. GET first.' });
        return;
      }
      if (workbook.status === 'final') {
        res
          .status(409)
          .json({ ok: false, error: 'Workbook is finalized and immutable.' });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const notesPatch = asPartialNotes(body.notes);

      let classification: Classification | null | undefined;
      if (body.classification === null) classification = null;
      else if (
        typeof body.classification === 'string' &&
        CLASSIFICATIONS.includes(body.classification as Classification)
      ) {
        classification = body.classification as Classification;
      }

      let firstActions: string[] | undefined;
      if (Array.isArray(body.firstActions)) {
        firstActions = body.firstActions
          .filter((s): s is string => typeof s === 'string')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }

      const partnershipNotes =
        typeof body.partnershipNotes === 'string'
          ? body.partnershipNotes
          : undefined;

      const updated = await saveWorkbookDraft({
        workbookId: workbook.workbookId,
        notes: notesPatch ?? undefined,
        classification,
        firstActions,
        partnershipNotes,
      });
      res.json({ ok: true, workbook: updated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Save failed: ${msg}` });
    }
  },
);

// ──────────────────────────────────────────────────────────────────────────────
// POST /:tmagId/finalize — irrevocable, triple-stack
// ──────────────────────────────────────────────────────────────────────────────
sponsorWorkbookRoutes.post(
  '/:tmagId/finalize',
  requireAuth,
  async (req: Request, res: Response) => {
    const rawTmagId = req.params.tmagId;
    const forTmagId = typeof rawTmagId === 'string' ? rawTmagId : '';
    if (!forTmagId) {
      res.status(400).json({ ok: false, error: 'tmagId path param required.' });
      return;
    }
    if (!(await authorizeSponsor(req, res, forTmagId))) return;

    try {
      const workbook = await getWorkbook(forTmagId);
      if (!workbook) {
        res
          .status(404)
          .json({ ok: false, error: 'No workbook draft to finalize.' });
        return;
      }
      if (workbook.status === 'final') {
        res.json({ ok: true, workbook, alreadyFinal: true });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;

      // Classification is required and must be one of the two.
      if (
        typeof body.classification !== 'string' ||
        !CLASSIFICATIONS.includes(body.classification as Classification)
      ) {
        res.status(400).json({
          ok: false,
          error: 'classification must be "gogetter" or "consumer".',
        });
        return;
      }
      const classification = body.classification as Classification;

      // First actions: 3 for gogetter, 1 for consumer.
      const rawActions = Array.isArray(body.firstActions) ? body.firstActions : [];
      const firstActions = rawActions
        .filter((s: unknown): s is string => typeof s === 'string')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const minActions = classification === 'gogetter' ? 3 : 1;
      if (firstActions.length < minActions) {
        res.status(400).json({
          ok: false,
          error: `${classification} classification requires at least ${minActions} first action(s).`,
        });
        return;
      }

      const partnershipNotes =
        typeof body.partnershipNotes === 'string' ? body.partnershipNotes : '';
      const notesPatch = asPartialNotes(body.notes) ?? {};

      const finalized = await finalizeWorkbook({
        workbookId: workbook.workbookId,
        classification,
        firstActions,
        partnershipNotes,
        notes: notesPatch,
      });

      // eslint-disable-next-line no-console
      console.log(
        `[audit] workbook_finalized forTmagId=${forTmagId} workbookId=${workbook.workbookId} classification=${classification} conductedBy=${workbook.conductedByTmagId}`,
      );

      res.json({ ok: true, workbook: finalized });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Finalize failed: ${msg}` });
    }
  },
);
