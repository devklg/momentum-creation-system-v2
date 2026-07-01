/**
 * Phase 7 memory-collection Mongoose models (governed doors — P7.12 §2).
 *
 * DRAFTED, NOT APPLIED. These schemas feed the existing generator
 * (`jsonSchema/generate.ts`) → applier (`jsonSchema/apply.ts`) pipeline to
 * produce first-pass `$jsonSchema` validators for the three new app-memory
 * collections. They are intentionally NOT wired into `registry.ts` and no
 * validator is applied here — wiring `getMongoSchema` + running `apply.ts` is
 * the separately-approved application step (write-freeze / Non-Destructive Rule).
 *
 * First-pass posture (P10 §3.7): `required` = the proven-always-present core;
 * `strict:false` → generator emits `additionalProperties:true` (tolerates the
 * optional/polymorphic fields; tighten to `false` per-collection only after a
 * soak). Timestamps are ISO-8601 STRINGS (`bsonType:'string'`), never `Date`
 * (P10 §3.3). Enums are declared on the Mongoose field (client-side validation
 * on direct writes) even though the generator emits only bsonType + required.
 *
 * The envelope core is shared by all three (P7.3 §4.2 app-memory envelope):
 *   id, type, schemaVersion, namespace, source, createdAt, title, originKind,
 *   serviceName, tenantId — all required. Gateway-only fields (chat_number,
 *   chat_registry_id, universal_gateway) are never declared here; the app writer
 *   never emits them, and the tighten step (additionalProperties:false) rejects
 *   them at the door.
 */
import { Schema } from 'mongoose';
import type { MongoDocument } from './registry.js';

const SCHEMA_OPTIONS = { strict: false as const, versionKey: false as const, minimize: false as const };

/** Required, shared app-memory envelope fields (camelCase, P7.3 §4.2). */
function envelopeCore() {
  return {
    _id: { type: Schema.Types.Mixed, required: true },
    id: { type: String, required: true },
    schemaVersion: { type: Number, required: true },
    namespace: { type: String, required: true, enum: ['momentum'] },
    source: { type: String, required: true },
    createdAt: { type: String, required: true },
    title: { type: String, required: true },
    originKind: { type: String, required: true, enum: ['system'] },
    serviceName: { type: String, required: true },
    tenantId: { type: String, required: true },
    // Team Magnificent membership scope (DECISION_team_magnificent_membership_canonical_identity).
    teamKey: { type: String, required: true, enum: ['team_magnificent'] },
    baId: { type: String },
    derivedFrom: { type: [String] },
  };
}

/** `mcs_outcomes` (R1 — P7.8). */
export function buildOutcomeSchema(): Schema<MongoDocument> {
  return new Schema<MongoDocument>(
    {
      ...envelopeCore(),
      type: { type: String, required: true, enum: ['outcome'] },
      kind: {
        type: String,
        required: true,
        enum: [
          'webinar_attended',
          'callback_completed',
          'orientation_attended',
          'became_customer',
          'enrolled_three',
          'declined',
          'no_show',
        ],
      },
      confirmedByBaId: { type: String, required: true },
      outcomeAt: { type: String, required: true },
      prospectId: { type: String },
      token: { type: String },
      note: { type: String },
      supersedesOutcomeId: { type: String },
    },
    SCHEMA_OPTIONS,
  );
}

/** `mcs_learning_candidates` (R2 — P7.9). */
export function buildLearningCandidateSchema(): Schema<MongoDocument> {
  return new Schema<MongoDocument>(
    {
      ...envelopeCore(),
      type: { type: String, required: true, enum: ['learning_candidate'] },
      status: {
        type: String,
        required: true,
        enum: ['detected', 'in_review', 'approved', 'rejected', 'superseded'],
      },
      domain: {
        type: String,
        required: true,
        enum: ['success', 'training', 'relationship', 'performance', 'organizational'],
      },
      language: { type: String, required: true, enum: ['en', 'es'] },
      proposedSummary: { type: String, required: true },
      sourceOutcomeIds: { type: [String], required: true },
      sourceSignalIds: { type: [String], required: true },
      teamKey: { type: String, required: true, enum: ['team_magnificent'] },
      // Review sub-document is optional (only present once a human decides). Kept
      // Mixed for first pass; a nested schema is a tighten-step refinement.
      review: { type: Schema.Types.Mixed },
      supersedesCandidateId: { type: String },
    },
    SCHEMA_OPTIONS,
  );
}

/** `mcs_graphrag_records` (R3 — P7.10). */
export function buildGraphRagRecordSchema(): Schema<MongoDocument> {
  return new Schema<MongoDocument>(
    {
      ...envelopeCore(),
      type: { type: String, required: true, enum: ['graphrag_record', 'graphrag_chunk'] },
      knowledgeObjectId: { type: String, required: true },
      version: { type: Number, required: true },
      domain: {
        type: String,
        required: true,
        enum: ['success', 'training', 'relationship', 'performance', 'organizational'],
      },
      language: { type: String, required: true, enum: ['en', 'es'] },
      summary: { type: String, required: true },
      model: { type: String, required: true, enum: ['all-MiniLM-L6-v2'] },
      modelVersion: { type: String, required: true },
      retrievalReady: { type: Boolean, required: true },
    },
    SCHEMA_OPTIONS,
  );
}

/**
 * The Phase 7 memory collections → schema builders. Wiring this into
 * `getMongoSchema` (registry.ts) + running `apply.ts` is the application step —
 * deliberately NOT done here.
 */
export const PHASE7_MONGO_SCHEMA_BUILDERS: Record<string, () => Schema<MongoDocument>> = {
  mcs_outcomes: buildOutcomeSchema,
  mcs_learning_candidates: buildLearningCandidateSchema,
  mcs_graphrag_records: buildGraphRagRecordSchema,
};
