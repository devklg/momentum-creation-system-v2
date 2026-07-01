/**
 * VM/RVM ownership invariants.
 *
 * Pure helper layer only: routes and domain writers still own stamping identity
 * from the authenticated BA, resolved token, or audited admin correction. Any
 * client payload containing ownership fields is rejected before persistence.
 */

import type { McsOwnedProspectIdentity, McsVmLeadIdentity } from '@momentum/shared';

export const CLIENT_OWNERSHIP_OVERRIDE_FIELDS = [
  'ownerTmagId',
  'sponsorTmagId',
  'leadBatchId',
  'vmCampaignId',
] as const;

export type ClientOwnershipOverrideField =
  (typeof CLIENT_OWNERSHIP_OVERRIDE_FIELDS)[number];

export class VmOwnershipError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VmOwnershipError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasNonEmptyString(
  value: Record<string, unknown>,
  key: string,
): boolean {
  return typeof value[key] === 'string' && value[key].trim().length > 0;
}

export function findClientOwnershipOverrideFields(
  payload: unknown,
): ClientOwnershipOverrideField[] {
  if (!isRecord(payload)) return [];
  return CLIENT_OWNERSHIP_OVERRIDE_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(payload, field),
  );
}

export function assertNoClientOwnershipOverride(payload: unknown): void {
  const fields = findClientOwnershipOverrideFields(payload);
  if (fields.length > 0) {
    throw new VmOwnershipError(`client_ownership_override:${fields.join(',')}`);
  }
}

export function assertOwnedProspectIdentity(
  value: unknown,
): asserts value is McsOwnedProspectIdentity {
  if (!isRecord(value)) throw new VmOwnershipError('ownership_not_object');
  if (!hasNonEmptyString(value, 'ownerTmagId')) {
    throw new VmOwnershipError('missing_owner_tm_ba_id');
  }
  if (!hasNonEmptyString(value, 'sponsorTmagId')) {
    throw new VmOwnershipError('missing_sponsor_tm_ba_id');
  }
}

export function assertVmLeadIdentity(
  value: unknown,
): asserts value is McsVmLeadIdentity {
  assertOwnedProspectIdentity(value);
  if (!isRecord(value)) throw new VmOwnershipError('ownership_not_object');
  if (!hasNonEmptyString(value, 'leadBatchId')) {
    throw new VmOwnershipError('missing_lead_batch_id');
  }
  if (!hasNonEmptyString(value, 'vmCampaignId')) {
    throw new VmOwnershipError('missing_vm_campaign_id');
  }
}

export function assertSameProspectOwner(
  expected: McsOwnedProspectIdentity,
  actual: McsOwnedProspectIdentity,
): void {
  if (expected.ownerTmagId !== actual.ownerTmagId) {
    throw new VmOwnershipError('owner_tm_ba_mismatch');
  }
  if (expected.sponsorTmagId !== actual.sponsorTmagId) {
    throw new VmOwnershipError('sponsor_tm_ba_mismatch');
  }
}

export function buildBaOwnedIdentity(tmagId: string): McsOwnedProspectIdentity {
  const normalized = tmagId.trim();
  if (!normalized) throw new VmOwnershipError('missing_tm_ba_id');
  return {
    ownerTmagId: normalized,
    sponsorTmagId: normalized,
  };
}
