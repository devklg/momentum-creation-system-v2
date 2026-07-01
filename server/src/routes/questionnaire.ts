/**
 * /api/onboarding/questionnaire routes.
 *
 * Three endpoints:
 *   GET    /status   - Has this BA submitted? Used by the React surface to
 *                      decide whether to render the form or the
 *                      already-submitted state.
 *   POST   /submit   - Triple-stack write of the 19 fields. Idempotent:
 *                      re-submitting returns the existing record.
 *   POST   /load     - Audit-log marker that the questionnaire surface was
 *                      displayed. Mirrors welcome.ts /load pattern.
 *
 * All three require auth. None use requireSteveComplete — the
 * questionnaire is a pre-Steve-gate surface (the BA fills it out within
 * 48 hours of signup, before or during Michael completion).
 *
 * Locked Chat #22: mandatory 48h post-enrollment. The gate enforcement for
 * downstream surfaces (Day 2+ training, sponsor workbook unlock) lives in
 * each downstream route's own gating, not here.
 */

import express, {
  type Request,
  type Response,
  type Router,
} from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getQuestionnaire,
  markQuestionnaireComplete,
  questionnaireExists,
  recordQuestionnaire,
  type QuestionnaireSubmission,
} from '../domain/questionnaire.js';

export const questionnaireRoutes: Router = express.Router();

// ────────────────────────────────────────────────────────────────────────────
// GET /status
// ────────────────────────────────────────────────────────────────────────────
questionnaireRoutes.get(
  '/status',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    try {
      const record = await getQuestionnaire(session.tmagId);
      if (!record) {
        res.json({ ok: true, submitted: false });
        return;
      }
      res.json({
        ok: true,
        submitted: true,
        submittedAt: record.submittedAt,
        questionnaireId: record.questionnaireId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res
        .status(500)
        .json({ ok: false, error: `Status check failed: ${msg}` });
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /load — audit marker only
// ────────────────────────────────────────────────────────────────────────────
questionnaireRoutes.post(
  '/load',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    // eslint-disable-next-line no-console
    console.log(
      `[audit] questionnaire_screen_displayed tmagId=${session.tmagId} threeBaId=${session.threeBaId}`,
    );
    res.json({ ok: true });
  },
);

// ────────────────────────────────────────────────────────────────────────────
// POST /submit
// ────────────────────────────────────────────────────────────────────────────
const REQUIRED_STRING_FIELDS: ReadonlyArray<keyof QuestionnaireSubmission> = [
  'fullName',
  'email',
  'phone',
  'city',
  'sponsor',
  'biggestWin',
  'whyNow',
  'incomeGoal',
  'incomeImpact',
  'last30Days',
  'obstacleResponse',
  'hardFeedback',
  'dealbreaker',
  'whyYou',
];

const REQUIRED_ENUM_FIELDS: Record<
  string,
  ReadonlyArray<string>
> = {
  employmentStatus: ['full_time', 'part_time', 'self_employed', 'retired'],
  productStatus: [
    'using_seeing_results',
    'using_just_started',
    'not_yet',
    'just_want_business',
  ],
  weeklyHours: ['5-10', '10-20', '20-30', '30+'],
  availability: ['yes_always', 'yes_usually', 'depends', 'no'],
  coachabilityTest: [
    'their_way_first',
    'discuss_together',
    'my_way',
    'test_both',
  ],
  nwmExperience: [
    'never',
    'tried_briefly',
    'some_success',
    'significant_success',
  ],
  investmentReady: [
    'yes_today',
    'yes_7_days',
    'need_2_weeks',
    'need_to_earn',
  ],
};

interface ValidationOk {
  ok: true;
  value: QuestionnaireSubmission;
}
interface ValidationErr {
  ok: false;
  error: string;
}

function validateBody(
  body: unknown,
): ValidationOk | ValidationErr {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Body must be a JSON object.' };
  }
  const b = body as Record<string, unknown>;

  // String fields
  for (const f of REQUIRED_STRING_FIELDS) {
    const v = b[f];
    if (typeof v !== 'string' || v.trim().length === 0) {
      return { ok: false, error: `Field ${f} is required.` };
    }
  }
  // Enum fields
  for (const [f, allowed] of Object.entries(REQUIRED_ENUM_FIELDS)) {
    const v = b[f];
    if (typeof v !== 'string' || !allowed.includes(v)) {
      return {
        ok: false,
        error: `Field ${f} must be one of: ${allowed.join(', ')}.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      fullName: (b.fullName as string).trim(),
      email: (b.email as string).trim().toLowerCase(),
      phone: (b.phone as string).trim(),
      city: (b.city as string).trim(),
      sponsor: (b.sponsor as string).trim(),
      employmentStatus: b.employmentStatus as QuestionnaireSubmission['employmentStatus'],
      biggestWin: (b.biggestWin as string).trim(),
      whyNow: (b.whyNow as string).trim(),
      productStatus: b.productStatus as QuestionnaireSubmission['productStatus'],
      incomeGoal: (b.incomeGoal as string).trim(),
      incomeImpact: (b.incomeImpact as string).trim(),
      last30Days: (b.last30Days as string).trim(),
      weeklyHours: b.weeklyHours as QuestionnaireSubmission['weeklyHours'],
      availability: b.availability as QuestionnaireSubmission['availability'],
      obstacleResponse: (b.obstacleResponse as string).trim(),
      coachabilityTest: b.coachabilityTest as QuestionnaireSubmission['coachabilityTest'],
      hardFeedback: (b.hardFeedback as string).trim(),
      nwmExperience: b.nwmExperience as QuestionnaireSubmission['nwmExperience'],
      investmentReady: b.investmentReady as QuestionnaireSubmission['investmentReady'],
      dealbreaker: (b.dealbreaker as string).trim(),
      whyYou: (b.whyYou as string).trim(),
    },
  };
}

questionnaireRoutes.post(
  '/submit',
  requireAuth,
  async (req: Request, res: Response) => {
    const session = req.session!;
    try {
      // Idempotency: if already submitted, return the existing record
      // without re-writing. Mirror BA-flag in case it drifted.
      if (await questionnaireExists(session.tmagId)) {
        await markQuestionnaireComplete(session.tmagId);
        const existing = await getQuestionnaire(session.tmagId);
        res.json({
          ok: true,
          alreadySubmitted: true,
          questionnaireId: existing?.questionnaireId,
        });
        return;
      }

      const validation = validateBody(req.body);
      if (!validation.ok) {
        res.status(400).json({ ok: false, error: validation.error });
        return;
      }

      const ipAddress =
        (req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0]
          ?.trim() ??
        req.socket.remoteAddress ??
        null;
      const userAgent = req.get('user-agent') ?? null;

      const record = await recordQuestionnaire({
        ...validation.value,
        tmagId: session.tmagId,
        threeBaId: session.threeBaId,
        ipAddress,
        userAgent,
      });

      await markQuestionnaireComplete(session.tmagId);

      // eslint-disable-next-line no-console
      console.log(
        `[audit] questionnaire_submitted tmagId=${session.tmagId} questionnaireId=${record.questionnaireId} version=${record.version}`,
      );

      res.json({
        ok: true,
        questionnaireId: record.questionnaireId,
        submittedAt: record.submittedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res
        .status(500)
        .json({ ok: false, error: `Could not record questionnaire: ${msg}` });
    }
  },
);
