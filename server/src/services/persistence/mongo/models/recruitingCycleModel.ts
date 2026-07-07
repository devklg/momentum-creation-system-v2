/**
 * ACR-0011 — `tmag_recruiting_cycles` Mongoose model (5 Point Recruiting Cycle).
 *
 * Mirrors the drafted-schema posture of `phase7Models.ts`: this builder feeds
 * the existing generator (`jsonSchema/generate.ts`) → applier (`jsonSchema/apply.ts`)
 * pipeline to author a first-pass `$jsonSchema` floor. It is intentionally NOT
 * wired into `registry.ts` here — wiring `getMongoSchema` + running `apply.ts`
 * is the separately-approved application step (Non-Destructive Rule). The
 * runtime `$jsonSchema` floor for provisioning is carried by the rev3 registry
 * entry (`tmag_recruiting_cycles` in `rev3-registry.mjs`); this model is the
 * canonical field-level definition the generator consumes.
 *
 * First-pass posture (matches phase7):
 *  - `required` = the proven-always-present core (tmagId, enrolledAt, targets,
 *    counts, currentStep, status, timestamps); optional milestone/attestation
 *    fields are nullable and NOT required.
 *  - `strict:false` → generator emits `additionalProperties:true`.
 *  - Timestamps are ISO-8601 STRINGS (`bsonType:'string'`), never `Date` (P10 §3.3).
 *  - Enums declared on the field for client-side validation on direct writes.
 *
 * Store naming: camelCase at rest, matching every sibling collection and the
 * shared domain type `McsRecruitingCycleRecord` (see the reconciliation note in
 * `packages/shared/src/recruiting-cycle.ts`). Each field maps 1:1 to the ACR
 * §2.4 snake_case name.
 */
import { Schema } from 'mongoose';
import {
  MCS_RECRUITING_CYCLE_STATUSES,
  MCS_RECRUITING_STEPS,
} from '@momentum/shared';
import type { MongoDocument } from './registry.js';

const SCHEMA_OPTIONS = { strict: false as const, versionKey: false as const, minimize: false as const };

/** `tmag_recruiting_cycles` — one launch recruiting cycle per BA (ACR §2.4). */
export function buildRecruitingCycleSchema(): Schema<MongoDocument> {
  return new Schema<MongoDocument>(
    {
      _id: { type: Schema.Types.Mixed, required: true },
      // Core identity + anchor.
      tmagId: { type: String, required: true },
      enrolledAt: { type: String, required: true },
      // Five-point milestone.
      fivePointTargetAt: { type: String, required: true },
      fivePointCompletedAt: { type: String, default: null },
      // QBA milestone (sponsor-attested only).
      qbaTargetAt: { type: String, required: true },
      qbaAchievedAt: { type: String, default: null },
      qbaLeftLegTmagId: { type: String, default: null },
      qbaRightLegTmagId: { type: String, default: null },
      qbaAttestedBy: { type: String, default: null },
      // CORE 3 milestone.
      core3AchievedAt: { type: String, default: null },
      core3TmagId: { type: String, default: null },
      // Names-list config (LOCKED constants stamped at creation).
      namesTarget: { type: Number, required: true },
      trancheSize: { type: Number, required: true },
      // Derived/cached step + activity.
      currentStep: {
        type: Number,
        required: true,
        enum: MCS_RECRUITING_STEPS as unknown as number[],
      },
      lastActivityAt: { type: String, required: true },
      stallFlaggedAt: { type: String, default: null },
      status: {
        type: String,
        required: true,
        enum: MCS_RECRUITING_CYCLE_STATUSES as unknown as string[],
      },
      createdAt: { type: String, required: true },
      updatedAt: { type: String, required: true },
    },
    SCHEMA_OPTIONS,
  );
}

/**
 * ACR-0011 recruiting-cycle collection → schema builder. Wiring this into
 * `getMongoSchema` (registry.ts) + running `apply.ts` is the application step —
 * deliberately NOT done here (matches phase7 posture).
 */
export const RECRUITING_CYCLE_MONGO_SCHEMA_BUILDERS: Record<string, () => Schema<MongoDocument>> = {
  tmag_recruiting_cycles: buildRecruitingCycleSchema,
};
