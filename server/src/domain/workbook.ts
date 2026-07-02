/**
 * BA Interview Workbook domain.
 *
 * Stage 3 of the three-stage onboarding spine (Chat #22, ported Chat #103):
 *   1. Michael voice call  (T+1-4h)   — outbound, 3 discovery questions
 *   2. Self-serve questionnaire (T+0-48h) — 19 BA-written answers
 *   3. THIS surface         (T+24-72h) — sponsor-led 30-45 min conversation
 *
 * Authorization: a sponsor can only conduct the workbook for a BA whose
 * sponsorTmagId == sponsor's tmagId. Admins can conduct for anyone. Enforcement
 * lives in the route layer (canConductWorkbook).
 *
 * Lifecycle:
 *   - Sponsor opens /sponsor/interview-workbook/{tmagId} → GET draft (or create).
 *   - Sponsor saves notes incrementally (autosave) → PUT /draft with merged notes.
 *   - Sponsor finalizes → POST /finalize with classification + first actions.
 *     Triple-stack write fires here, not on every autosave (Chroma docs would
 *     churn if we wrote every keystroke). Drafts are Mongo-only.
 *
 * Locked Chat #22: gogetter vs consumer classification. Gogetter = deep
 * investment, weekly calls, sponsor builds WITH them. Consumer = system
 * access only, no personal sponsor time.
 *
 * Per TEAM Design Section C.6 (sponsor workbook, locked Chat #22/#103).
 */

import { tripleStackWrite } from '../services/tripleStack.js';
import { gatewayCall } from '../services/gateway.js';

export const WORKBOOK_VERSION = 'v1_2026_05_19';

export type WorkbookStatus = 'draft' | 'final';
export type Classification = 'gogetter' | 'consumer';

/**
 * 20-note shape. Each q?? maps to a question in the Workbook conversation
 * script. Fields are intentionally generic-named so the schema stays stable
 * even if a future version edits the wording of a specific prompt — the
 * React surface owns the prompt copy; the domain owns the storage.
 */
export interface WorkbookNotes {
  // Section 1 — Opening & Connection (Qs 1-3)
  q1_biggest_win_followup: string;
  q2_why_now_followup: string;
  q3_income_goal_first_change: string;
  // Section 2 — Product Conviction (Qs 4-6)
  q4_product_experience: string;
  q5_best_friend_pitch: string;
  q6_product_excitement_1_to_10: string;
  // Section 3 — Execution & Follow-Through (Qs 7-10)
  q7_pushed_through_completion: string;
  q8_falling_behind_response: string;
  q9_hours_giving_up: string;
  q10_uncomfortable_action_reaction: string;
  // Section 4 — Coachability & Partnership (Qs 11-14)
  q11_feedback_acceptance_speed: string;
  q12_my_way_vs_their_way: string;
  q13_biggest_fear: string;
  q14_quitting_pattern: string;
  // Section 5 — Financial Reality & Commitment (Qs 15-17)
  q15_invest_500_reaction: string;
  q16_90_days_no_money: string;
  q17_dealbreaker_can_we_prevent: string;
  // Section 6 — Establishing the Partnership (Qs 18-20)
  q18_contract_agreement: string;
  q19_accountability_acceptance: string;
  q20_sell_me_on_you: string;
}

export interface WorkbookRecord {
  workbookId: string;
  /** The BA being interviewed. */
  forTmagId: string;
  forThreeBaId: string;
  /** The sponsor conducting the interview. */
  conductedByTmagId: string;
  conductedByName: string;
  status: WorkbookStatus;
  version: string;
  notes: WorkbookNotes;
  classification: Classification | null;
  /** Optional first-action assignments (3 for gogetter, 1 for consumer). */
  firstActions: string[];
  /** Sponsor's overall partnership notes (free-form). */
  partnershipNotes: string;
  createdAt: string;
  updatedAt: string;
  finalizedAt: string | null;
}

const EMPTY_NOTES: WorkbookNotes = {
  q1_biggest_win_followup: '',
  q2_why_now_followup: '',
  q3_income_goal_first_change: '',
  q4_product_experience: '',
  q5_best_friend_pitch: '',
  q6_product_excitement_1_to_10: '',
  q7_pushed_through_completion: '',
  q8_falling_behind_response: '',
  q9_hours_giving_up: '',
  q10_uncomfortable_action_reaction: '',
  q11_feedback_acceptance_speed: '',
  q12_my_way_vs_their_way: '',
  q13_biggest_fear: '',
  q14_quitting_pattern: '',
  q15_invest_500_reaction: '',
  q16_90_days_no_money: '',
  q17_dealbreaker_can_we_prevent: '',
  q18_contract_agreement: '',
  q19_accountability_acceptance: '',
  q20_sell_me_on_you: '',
};

/**
 * Authorization predicate. The sponsor's tmagId must equal the target BA's
 * sponsorTmagId for the workbook to be permitted. Admin override happens at
 * the route layer; this function is for the sponsor case.
 */
export async function canConductWorkbook(args: {
  sponsorTmagId: string;
  forTmagId: string;
}): Promise<boolean> {
  const result = await gatewayCall<{ documents: { sponsorTmagId?: string }[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'team_magnificent_members',
      filter: { tmagId: args.forTmagId },
      limit: 1,
    },
  );
  const ba = result.documents[0];
  if (!ba) return false;
  return ba.sponsorTmagId === args.sponsorTmagId;
}

export async function getWorkbook(
  forTmagId: string,
): Promise<WorkbookRecord | null> {
  const result = await gatewayCall<{ documents: WorkbookRecord[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'tmag_workbooks',
      filter: { forTmagId },
      limit: 1,
    },
  );
  return result.documents.length > 0 ? result.documents[0] ?? null : null;
}

/**
 * Create a fresh draft workbook for a BA. Called the first time the sponsor
 * opens the surface. Mongo-only (drafts don't need graph or semantic search
 * — those fire on finalize).
 */
export async function createWorkbookDraft(args: {
  forTmagId: string;
  forThreeBaId: string;
  conductedByTmagId: string;
  conductedByName: string;
}): Promise<WorkbookRecord> {
  const now = new Date().toISOString();
  const workbookId = `wbook_${args.forTmagId}_${Date.now().toString(36)}`;
  const record: WorkbookRecord = {
    workbookId,
    forTmagId: args.forTmagId,
    forThreeBaId: args.forThreeBaId,
    conductedByTmagId: args.conductedByTmagId,
    conductedByName: args.conductedByName,
    status: 'draft',
    version: WORKBOOK_VERSION,
    notes: { ...EMPTY_NOTES },
    classification: null,
    firstActions: [],
    partnershipNotes: '',
    createdAt: now,
    updatedAt: now,
    finalizedAt: null,
  };

  await gatewayCall('mongodb', 'insert', {
    database: 'momentum',
    collection: 'tmag_workbooks',
    documents: [{ _id: workbookId, ...record }],
  });

  return record;
}

/**
 * Save a draft. Merges the provided patch into the existing notes/fields.
 * Mongo-only write — autosaves can happen many times per minute and we
 * don't want to churn the graph or Chroma. Triple-stack fires on finalize.
 *
 * Returns the updated record.
 */
export async function saveWorkbookDraft(args: {
  workbookId: string;
  notes?: Partial<WorkbookNotes>;
  classification?: Classification | null;
  firstActions?: string[];
  partnershipNotes?: string;
}): Promise<WorkbookRecord | null> {
  const existing = await gatewayCall<{ documents: WorkbookRecord[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'tmag_workbooks',
      filter: { workbookId: args.workbookId },
      limit: 1,
    },
  );
  const current = existing.documents[0];
  if (!current) return null;
  if (current.status === 'final') {
    // Finalized workbooks are immutable.
    return current;
  }

  const mergedNotes: WorkbookNotes = { ...current.notes, ...(args.notes ?? {}) };
  const updatedAt = new Date().toISOString();
  const $set: Record<string, unknown> = {
    notes: mergedNotes,
    updatedAt,
  };
  if (args.classification !== undefined) $set.classification = args.classification;
  if (args.firstActions !== undefined) $set.firstActions = args.firstActions;
  if (args.partnershipNotes !== undefined) $set.partnershipNotes = args.partnershipNotes;

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'tmag_workbooks',
    filter: { workbookId: args.workbookId },
    update: { $set },
  });

  return {
    ...current,
    notes: mergedNotes,
    classification:
      args.classification !== undefined ? args.classification : current.classification,
    firstActions: args.firstActions ?? current.firstActions,
    partnershipNotes:
      args.partnershipNotes !== undefined ? args.partnershipNotes : current.partnershipNotes,
    updatedAt,
  };
}

/**
 * Finalize a workbook. Requires a classification. Triple-stack write fires
 * here so the partnership decision is durable in Mongo (status=final),
 * Neo4j (sponsor -[:CONDUCTED]-> workbook, classification on edge), and
 * ChromaDB (rich semantic doc of the 20 notes for sponsor-coaching
 * retrieval later).
 *
 * Idempotent: re-finalizing returns the existing finalized record.
 */
export async function finalizeWorkbook(args: {
  workbookId: string;
  classification: Classification;
  firstActions: string[];
  partnershipNotes: string;
  notes: Partial<WorkbookNotes>;
}): Promise<WorkbookRecord | null> {
  const existing = await gatewayCall<{ documents: WorkbookRecord[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: 'tmag_workbooks',
      filter: { workbookId: args.workbookId },
      limit: 1,
    },
  );
  const current = existing.documents[0];
  if (!current) return null;
  if (current.status === 'final') return current;

  const mergedNotes: WorkbookNotes = { ...current.notes, ...args.notes };
  const finalizedAt = new Date().toISOString();

  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'tmag_workbooks',
    filter: { workbookId: args.workbookId },
    update: {
      $set: {
        status: 'final',
        notes: mergedNotes,
        classification: args.classification,
        firstActions: args.firstActions,
        partnershipNotes: args.partnershipNotes,
        updatedAt: finalizedAt,
        finalizedAt,
      },
    },
  });

  // Graph: sponsor -[:CONDUCTED]-> workbook -[:FOR]-> BA. Classification is
  // a property on the workbook node so an upline cockpit can MATCH on it.
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MERGE (s:TeamMagnificentMember {tmagId: $sponsorTmagId}) ' +
      'MERGE (b:TeamMagnificentMember {tmagId: $forTmagId}) ' +
      'MERGE (w:TmagWorkbook {workbookId: $workbookId}) ' +
      'SET w.status = $status, w.classification = $classification, ' +
      'w.version = $version, w.finalizedAt = $finalizedAt ' +
      'MERGE (s)-[:CONDUCTED]->(w) ' +
      'MERGE (w)-[:FOR]->(b)',
    params: {
      sponsorTmagId: current.conductedByTmagId,
      forTmagId: current.forTmagId,
      workbookId: args.workbookId,
      status: 'final',
      classification: args.classification,
      version: WORKBOOK_VERSION,
      finalizedAt,
    },
  });

  // Rich semantic document of every captured note so the sponsor can
  // retrieve coaching context across past partnerships ("show me BAs I
  // classified gogetter whose biggest fear was rejection").
  const chromaDoc = [
    `Workbook conducted by ${current.conductedByName} (BA ${current.conductedByTmagId}) for BA ${current.forTmagId} (THREE ${current.forThreeBaId}) at ${finalizedAt}.`,
    `Classification: ${args.classification.toUpperCase()}.`,
    `Partnership notes: ${args.partnershipNotes}`,
    `First actions assigned: ${args.firstActions.join(' | ')}`,
    '---',
    `Q1 biggest-win followup: ${mergedNotes.q1_biggest_win_followup}`,
    `Q2 why-now followup: ${mergedNotes.q2_why_now_followup}`,
    `Q3 income-goal first change: ${mergedNotes.q3_income_goal_first_change}`,
    `Q4 product experience: ${mergedNotes.q4_product_experience}`,
    `Q5 best-friend pitch: ${mergedNotes.q5_best_friend_pitch}`,
    `Q6 product excitement 1-10: ${mergedNotes.q6_product_excitement_1_to_10}`,
    `Q7 pushed through completion: ${mergedNotes.q7_pushed_through_completion}`,
    `Q8 falling behind response: ${mergedNotes.q8_falling_behind_response}`,
    `Q9 hours giving up: ${mergedNotes.q9_hours_giving_up}`,
    `Q10 uncomfortable action reaction: ${mergedNotes.q10_uncomfortable_action_reaction}`,
    `Q11 feedback acceptance speed: ${mergedNotes.q11_feedback_acceptance_speed}`,
    `Q12 my way vs their way: ${mergedNotes.q12_my_way_vs_their_way}`,
    `Q13 biggest fear: ${mergedNotes.q13_biggest_fear}`,
    `Q14 quitting pattern: ${mergedNotes.q14_quitting_pattern}`,
    `Q15 invest 500 reaction: ${mergedNotes.q15_invest_500_reaction}`,
    `Q16 90 days no money: ${mergedNotes.q16_90_days_no_money}`,
    `Q17 dealbreaker can we prevent: ${mergedNotes.q17_dealbreaker_can_we_prevent}`,
    `Q18 contract agreement: ${mergedNotes.q18_contract_agreement}`,
    `Q19 accountability acceptance: ${mergedNotes.q19_accountability_acceptance}`,
    `Q20 sell me on you: ${mergedNotes.q20_sell_me_on_you}`,
  ].join('\n');

  await gatewayCall('chromadb', 'add', {
    collection: 'tmag_workbooks',
    ids: [args.workbookId],
    documents: [chromaDoc],
    metadatas: [
      {
        workbookId: args.workbookId,
        forTmagId: current.forTmagId,
        forThreeBaId: current.forThreeBaId,
        conductedByTmagId: current.conductedByTmagId,
        classification: args.classification,
        version: WORKBOOK_VERSION,
        finalizedAt,
        kind: 'ba_workbook',
      },
    ],
  });

  // Mirror the partnership classification on the BA record so upline
  // dashboards can filter without joining.
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId: current.forTmagId },
    update: {
      $set: {
        workbook_complete: true,
        workbook_finalized_at: finalizedAt,
        partnership_classification: args.classification,
      },
    },
  });

  return {
    ...current,
    status: 'final',
    notes: mergedNotes,
    classification: args.classification,
    firstActions: args.firstActions,
    partnershipNotes: args.partnershipNotes,
    updatedAt: finalizedAt,
    finalizedAt,
  };
}

/**
 * Use the explicit triple-stack helper for the first-ever finalize so we
 * still flow through the shared write path. (Re-export of the helper kept
 * unused here because the finalize logic above interleaves three calls with
 * different semantics: update + cypher + add. Wrapping them in
 * tripleStackWrite would require an `update` mode it doesn't expose. We
 * keep the per-call pattern but maintain the same Mongo + Neo4j + Chroma
 * guarantee.)
 */
void tripleStackWrite;
