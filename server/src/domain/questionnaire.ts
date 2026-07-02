/**
 * BA Interview Questionnaire domain.
 *
 * The questionnaire is the SECOND stage of the three-stage onboarding spine
 * (Chat #22 + Chat #25 architecture, recovered in Chat #103):
 *
 *   T+1-4h   Steve discovery + Success Profile               ← /api/steve/*
 *   T+0-48h  Self-serve questionnaire (this domain)          ← /api/onboarding/questionnaire/*
 *   T+24-72h Sponsor-led workbook call (30-45 min, 20 Qs)    ← future /api/sponsor/workbook/*
 *
 * Locked Chat #22: Mandatory within 48 hours post-enrollment. No completion →
 * no access to Team Magnificent mentorship. Surfaces gogetter indicators.
 *
 * Triple-stack persisted. One submission per BA (the sponsor reviews it
 * before the Workbook call). Idempotent: re-submitting returns ok with the
 * existing record. This matches the commitments domain's contract.
 *
 * Per TEAM Design Section C.5 (onboarding spine, locked Chat #22/#25/#103).
 */

import { tripleStackWrite } from '../services/tripleStack.js';
import { persistenceCall } from '../services/persistence/dispatch.js';

export const QUESTIONNAIRE_VERSION = 'v1_2026_05_19';

/**
 * Maps 1:1 to the BA Interview Questionnaire HTML form fields recovered
 * from Chat #22 (ba-interview-questionnaire.html). Field names mirror the
 * form's name attribute exactly so the React port is a 1:1 translation.
 */
export interface QuestionnaireSubmission {
  /** Basic identity (some fields duplicate the BA record so the snapshot
   *  the sponsor reviews is what the BA wrote on this day, not what's on
   *  the live profile.) */
  fullName: string;
  email: string;
  phone: string;
  city: string;
  sponsor: string;

  /** Section: About You */
  employmentStatus: 'full_time' | 'part_time' | 'self_employed' | 'retired';
  biggestWin: string;
  whyNow: string;

  /** Section: Product & Goals */
  productStatus:
    | 'using_seeing_results'
    | 'using_just_started'
    | 'not_yet'
    | 'just_want_business';
  incomeGoal: string;
  incomeImpact: string;

  /** Section: Execution & Commitment */
  last30Days: string;
  weeklyHours: '5-10' | '10-20' | '20-30' | '30+';
  availability: 'yes_always' | 'yes_usually' | 'depends' | 'no';
  obstacleResponse: string;

  /** Section: Coachability */
  coachabilityTest:
    | 'their_way_first'
    | 'discuss_together'
    | 'my_way'
    | 'test_both';
  hardFeedback: string;
  nwmExperience:
    | 'never'
    | 'tried_briefly'
    | 'some_success'
    | 'significant_success';

  /** Section: Financial Readiness */
  investmentReady:
    | 'yes_today'
    | 'yes_7_days'
    | 'need_2_weeks'
    | 'need_to_earn';
  dealbreaker: string;
  whyYou: string;
}

export interface QuestionnaireRecord extends QuestionnaireSubmission {
  questionnaireId: string;
  tmagId: string;
  threeBaId: string;
  version: string;
  submittedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Check if a BA has already submitted the questionnaire. Used both for
 * idempotency in the submit handler and for gate decisions in BA-facing
 * surfaces (the sponsor workbook surface, for example, requires the
 * questionnaire to exist before it renders).
 */
export async function questionnaireExists(tmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ count: number }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_questionnaires',
    filter: { tmagId },
    limit: 1,
  });
  return result.count > 0;
}

/**
 * Retrieve the questionnaire submission for a BA. Returns null if none
 * exists. Used by:
 *   - The questionnaire status endpoint (so the React surface knows
 *     whether to render the form or the "already submitted" state).
 *   - The future sponsor workbook surface (so the sponsor can read the
 *     BA's responses while running the 20-question conversation).
 */
export async function getQuestionnaire(
  tmagId: string,
): Promise<QuestionnaireRecord | null> {
  const result = await persistenceCall<{ documents: QuestionnaireRecord[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'mcs_questionnaires',
      filter: { tmagId },
      limit: 1,
    },
  );
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}

/**
 * Record a questionnaire submission. Triple-stack write so the BA's words
 * are durable in Mongo (authoritative), Neo4j (graph relationship for
 * upline cockpit views), and ChromaDB (semantic search across submissions
 * for sponsor coaching).
 *
 * The Chroma document is an intentionally rich summary of the BA's free-
 * text answers so semantic search later ("show me BAs who said their
 * biggest win was a fitness goal") actually returns useful results.
 */
export async function recordQuestionnaire(
  input: QuestionnaireSubmission & {
    tmagId: string;
    threeBaId: string;
    ipAddress: string | null;
    userAgent: string | null;
  },
): Promise<QuestionnaireRecord> {
  const submittedAt = new Date().toISOString();
  const questionnaireId = `quest_${input.tmagId}_${Date.now().toString(36)}`;

  const record: QuestionnaireRecord = {
    questionnaireId,
    tmagId: input.tmagId,
    threeBaId: input.threeBaId,
    version: QUESTIONNAIRE_VERSION,
    submittedAt,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    city: input.city,
    sponsor: input.sponsor,
    employmentStatus: input.employmentStatus,
    biggestWin: input.biggestWin,
    whyNow: input.whyNow,
    productStatus: input.productStatus,
    incomeGoal: input.incomeGoal,
    incomeImpact: input.incomeImpact,
    last30Days: input.last30Days,
    weeklyHours: input.weeklyHours,
    availability: input.availability,
    obstacleResponse: input.obstacleResponse,
    coachabilityTest: input.coachabilityTest,
    hardFeedback: input.hardFeedback,
    nwmExperience: input.nwmExperience,
    investmentReady: input.investmentReady,
    dealbreaker: input.dealbreaker,
    whyYou: input.whyYou,
  };

  // Build a rich Chroma document — every free-text answer goes in so the
  // sponsor can semantic-search across submissions later.
  const chromaDocument = [
    `BA ${input.tmagId} (${input.email}) submitted Team Magnificent interview questionnaire ${QUESTIONNAIRE_VERSION} at ${submittedAt}.`,
    `City: ${input.city}. Sponsor named: ${input.sponsor}. Employment: ${input.employmentStatus}.`,
    `Biggest win (last 3 years): ${input.biggestWin}`,
    `Why now: ${input.whyNow}`,
    `Product status: ${input.productStatus}. Income goal: ${input.incomeGoal}. What that income changes: ${input.incomeImpact}`,
    `Last 30 days completion example: ${input.last30Days}`,
    `Weekly hours: ${input.weeklyHours}. 6am Saturday call response: ${input.availability}.`,
    `20-call obstacle response: ${input.obstacleResponse}`,
    `Coachability default: ${input.coachabilityTest}. Hard feedback story: ${input.hardFeedback}`,
    `NWM experience: ${input.nwmExperience}.`,
    `Investment readiness: ${input.investmentReady}. Dealbreaker: ${input.dealbreaker}`,
    `Why invest in them: ${input.whyYou}`,
  ].join(' | ');

  await tripleStackWrite({
    id: questionnaireId,
    mongoCollection: 'tmag_questionnaires',
    mongoDoc: record as unknown as Record<string, unknown>,
    neo4j: {
      // BA -[:SUBMITTED]-> Questionnaire pattern. Sponsor cockpit views
      // walk this edge to surface the questionnaire alongside the BA.
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
        'MERGE (q:TmagQuestionnaire {questionnaireId: $id}) ' +
        'SET q.version = $version, q.submittedAt = $submittedAt, ' +
        'q.weeklyHours = $weeklyHours, q.investmentReady = $investmentReady, ' +
        'q.nwmExperience = $nwmExperience, q.employmentStatus = $employmentStatus ' +
        'MERGE (b)-[:SUBMITTED]->(q)',
      params: {
        tmagId: input.tmagId,
        version: QUESTIONNAIRE_VERSION,
        submittedAt,
        weeklyHours: input.weeklyHours,
        investmentReady: input.investmentReady,
        nwmExperience: input.nwmExperience,
        employmentStatus: input.employmentStatus,
      },
    },
    chroma: {
      collection: 'mcs_questionnaires',
      document: chromaDocument,
      metadata: {
        questionnaireId,
        tmagId: input.tmagId,
        threeBaId: input.threeBaId,
        version: QUESTIONNAIRE_VERSION,
        submittedAt,
        kind: 'ba_questionnaire',
        // Structured signals for filter-search later.
        weeklyHours: input.weeklyHours,
        investmentReady: input.investmentReady,
        productStatus: input.productStatus,
        coachabilityTest: input.coachabilityTest,
        nwmExperience: input.nwmExperience,
      },
    },
  });

  return record;
}

/**
 * Mirror flag on the BA record. Lets cockpit and admin surfaces filter on
 * `questionnaire_complete` without needing to join across collections.
 * Same pattern as markCommitmentAccepted / markWelcomeSeen.
 */
export async function markQuestionnaireComplete(tmagId: string): Promise<void> {
  const completedAt = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    update: {
      $set: {
        questionnaire_complete: true,
        questionnaire_completed_at: completedAt,
      },
    },
  });
}
