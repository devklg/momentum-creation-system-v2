/**
 * Generator domain (Chat #131) — the per-product, multi-angle WDYK workflow
 * that converges every selected Ivory name onto ONE action: mint that
 * product's /p/{token} invite via the existing spine.
 *
 * BOUNDARY:
 *   - Generator does NOT mint tokens itself. It calls createInvitation()
 *     from domain/invitations.ts with source='ivory' and stamps the result
 *     onto the run record + the corresponding Ivory name.
 *   - Generator does NOT own warm-market identity. Ivory does. A run holds
 *     a list of ivoryIds, NOT a copy of name data.
 *   - Generator never speaks to the prospect. The BA copies the link and
 *     texts it from their own phone (locked-spec 1.13).
 *
 * RUN LIFECYCLE:
 *   - createGeneratorRun({ tmagId, productKey, angle, selectedIvoryIds? })
 *     opens a run keyed by genrun_${uuid}. Status is implicit — runs are
 *     append-only; a run "ends" when the BA navigates away. We persist
 *     enough to reconstruct the timeline ("on Tue you worked Visage/
 *     lose-fat across these 6 names, minted 4 tokens, skipped 2").
 *   - mintInvitationForRun({ runId, ivoryId, ... }) mints exactly one
 *     /p/{token}, updates the Ivory name to status='invited' +
 *     lastProspectId, and appends to run.invitations[].
 *   - getGeneratorRun(runId, tmagId) fetches the run; the UI uses it to
 *     restore state after a refresh.
 *
 * PERSISTENCE:
 *   - Mongo: `generator_runs` (one doc per run, tmagId-scoped).
 *   - Neo4j: (:BA)-[:RAN_GENERATOR]->(:GeneratorRun) — useful for "show
 *     me every product I've ever run" timelines later.
 *   - Chroma: `mcs_ivory` (shared with Ivory roster events). Each run
 *     writes a single "started" event; each mint writes nothing new to
 *     Chroma because the invitation spine already triple-stacks under
 *     `mcs_invitations`. Avoid double-logging.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import {
  MCS_PRODUCT_KEYS,
  findProductByKey,
  type McsCatalogProduct,
} from '@momentum/shared';
import type {
  McsCreateGeneratorRunPayload,
  McsGeneratorRun,
  McsIvoryAngle,
} from '@momentum/shared';
import { createInvitation } from './invitations.js';
import { normalizePhone } from './prospectAccount.js';
import {
  getIvoryName,
  markIvoryInvited,
  IvoryNotFoundError,
  IvoryOwnershipError,
} from './ivory.js';

const MONGO_DB = 'momentum';
const RUNS_COLLECTION = 'generator_runs';
const CHROMA_COLLECTION = 'mcs_ivory';

const ALLOWED_ANGLES: ReadonlySet<McsIvoryAngle> = new Set([
  'do_the_business',
  'make_money',
  'lose_fat',
  'unspecified',
]);

export class GeneratorValidationError extends Error {
  constructor(public readonly code: string) {
    super(`generator_validation: ${code}`);
    this.name = 'GeneratorValidationError';
  }
}

export class GeneratorNotFoundError extends Error {
  constructor(public readonly runId: string) {
    super(`generator_run_not_found: ${runId}`);
    this.name = 'GeneratorNotFoundError';
  }
}

export class GeneratorOwnershipError extends Error {
  constructor(public readonly runId: string) {
    super(`generator_ownership_mismatch: ${runId}`);
    this.name = 'GeneratorOwnershipError';
  }
}

function validateProduct(productKey: string): McsCatalogProduct {
  if (!MCS_PRODUCT_KEYS.has(productKey)) {
    throw new GeneratorValidationError('invalid_product_key');
  }
  const product = findProductByKey(productKey);
  if (!product) throw new GeneratorValidationError('invalid_product_key');
  return product;
}

function validateAngle(angle: McsIvoryAngle): McsIvoryAngle {
  if (!ALLOWED_ANGLES.has(angle)) {
    throw new GeneratorValidationError('invalid_angle');
  }
  return angle;
}

/**
 * Open a Generator run. Pre-selected ivoryIds are validated as
 * belonging to this BA so the UI cannot smuggle a foreign id in.
 */
export async function createGeneratorRun(
  tmagId: string,
  input: McsCreateGeneratorRunPayload,
): Promise<McsGeneratorRun> {
  const product = validateProduct(input.productKey);
  const angle = validateAngle(input.angle);
  const preselected = input.selectedIvoryIds ?? [];

  // Light ownership check on every pre-selected name. We don't snapshot the
  // names onto the run — the UI reads them live from Ivory — but we DO want
  // a 400 if any id is foreign.
  for (const ivoryId of preselected) {
    try {
      await getIvoryName(ivoryId, tmagId);
    } catch (err) {
      if (err instanceof IvoryNotFoundError) {
        throw new GeneratorValidationError('unknown_ivory_id');
      }
      if (err instanceof IvoryOwnershipError) {
        throw new GeneratorValidationError('foreign_ivory_id');
      }
      throw err;
    }
  }

  const runId = `genrun_${randomUUID()}`;
  const now = new Date().toISOString();

  const run: McsGeneratorRun = {
    runId,
    tmagId,
    productKey: product.productKey,
    productName: product.productName,
    angle,
    selectedIvoryIds: preselected,
    invitations: [],
    createdAt: now,
    updatedAt: now,
  };

  await tripleStackWrite({
    id: runId,
    mongoCollection: RUNS_COLLECTION,
    mongoDoc: { ...run },
    neo4j: {
      cypher:
        'MERGE (b:BA {tmagId: $tmagId}) ' +
        'CREATE (r:GeneratorRun {' +
        '  runId: $id, productKey: $productKey, angle: $angle, createdAt: $createdAt' +
        '}) ' +
        'MERGE (b)-[:RAN_GENERATOR]->(r)',
      params: {
        tmagId,
        productKey: product.productKey,
        angle,
        createdAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `BA ${tmagId} opened a Generator run on ${product.productName} ` +
        `(angle: ${angle}) with ${preselected.length} pre-selected names ` +
        `at ${now}.`,
      metadata: {
        kind: 'generator_run_started',
        runId,
        tmagId,
        productKey: product.productKey,
        angle,
        createdAt: now,
      },
    },
  });

  return run;
}

/** Fetch a Generator run, enforcing BA ownership. */
export async function getGeneratorRun(
  runId: string,
  tmagId: string,
): Promise<McsGeneratorRun> {
  const res = await gatewayCall<{
    count: number;
    documents: Array<McsGeneratorRun & { _id?: unknown }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: RUNS_COLLECTION,
    filter: { runId },
    limit: 1,
  });
  const doc = res.documents[0];
  if (!doc) throw new GeneratorNotFoundError(runId);
  if (doc.tmagId !== tmagId) throw new GeneratorOwnershipError(runId);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as unknown as McsGeneratorRun;
}

export interface MintForRunInput {
  runId: string;
  tmagId: string;
  ivoryId: string;
  message?: string | null;
  city?: string;
  stateOrRegion?: string;
  phone?: string | null;
  email?: string | null;
}

export interface MintForRunResult {
  run: McsGeneratorRun;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Mint a single invitation for one Ivory name inside a run.
 *
 * Order of operations:
 *   1. Load the run + the Ivory name. Ownership guarded on both.
 *   2. Call createInvitation() — the spine triple-stacks the prospect +
 *      token, source='ivory'. Sponsor is the run's tmagId (sponsor immutability,
 *      locked-spec 3.5 — derived from session at the route layer, not the body).
 *   3. markIvoryInvited() — flips status to 'invited' + stamps lastProspectId
 *      on the Ivory record. This also adds the (:IvoryName)-[:INVITED_AS]
 *      ->(:Prospect) edge.
 *   4. Append to run.invitations[] in Mongo + update the run's updatedAt.
 *
 * If step 2 succeeds but 3 or 4 fail, we've leaked an unlinked prospect.
 * The spine record itself is fine (cockpit shows it); we just surface the
 * error so the BA can retry from the UI. No partial rollback — this matches
 * the pattern in invitations.ts step-3 commentary.
 */
export async function mintInvitationForRun(
  input: MintForRunInput,
): Promise<MintForRunResult> {
  const run = await getGeneratorRun(input.runId, input.tmagId);
  const name = await getIvoryName(input.ivoryId, input.tmagId);
  const city = (input.city ?? '').trim();
  const stateOrRegion = (input.stateOrRegion ?? '').trim();
  const phone = (input.phone ?? '').trim();
  if (!city) throw new GeneratorValidationError('invalid_city');
  if (!stateOrRegion) throw new GeneratorValidationError('invalid_state');
  if (!phone) throw new GeneratorValidationError('phone_required');
  if (!normalizePhone(phone)) throw new GeneratorValidationError('phone_invalid');

  const created = await createInvitation({
    sponsorTmagId: input.tmagId,
    firstName: name.firstName,
    lastName: name.lastName,
    email: input.email ?? null,
    phone,
    city,
    stateOrRegion,
    country: 'US',
    message: input.message ?? null,
    source: 'ivory',
    relationshipReason: null,
  });

  await markIvoryInvited(input.ivoryId, input.tmagId, created.prospectId);

  const now = new Date().toISOString();
  const newEntry = {
    ivoryId: input.ivoryId,
    prospectId: created.prospectId,
    token: created.token,
    inviteUrl: created.inviteUrl,
    createdAt: created.createdAt,
  };
  const updatedInvitations = [...run.invitations, newEntry];

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: RUNS_COLLECTION,
    filter: { runId: input.runId },
    update: {
      $set: {
        invitations: updatedInvitations,
        updatedAt: now,
      },
    },
  });

  return {
    run: { ...run, invitations: updatedInvitations, updatedAt: now },
    prospectId: created.prospectId,
    token: created.token,
    inviteUrl: created.inviteUrl,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
  };
}
