import type {
  McsStevePrivateExport,
  McsStevePrivacyState,
  McsSteveSponsorConsentField,
  McsSteveSponsorConsentGrant,
} from '@momentum/shared';
import {
  MCS_STEVE_PRIVACY_POLICY_VERSION,
  MCS_STEVE_SPONSOR_CONSENT_FIELDS,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { appendAuditEntry } from './auditLog.js';

const MONGO_DB = 'momentum';
const DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';
const CHROMA_DISCOVERIES = 'mcs_steve_success_interview';

interface PersistedPrivacyDiscovery {
  _id: string;
  tmagId: string;
  startedAt?: string | null;
  completedAt?: string | null;
  transcript?: McsStevePrivateExport['transcript'];
  answers?: McsStevePrivateExport['answers'];
  successProfile?: McsStevePrivateExport['successProfile'];
  privacy?: unknown;
}

interface MemberSponsor {
  sponsorTmagId?: string | null;
}

export class StevePrivacyError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'StevePrivacyError';
  }
}

function emptyGrant(field: McsSteveSponsorConsentField): McsSteveSponsorConsentGrant {
  return {
    field,
    granted: false,
    sponsorTmagId: null,
    grantedAt: null,
    revokedAt: null,
  };
}

export function defaultStevePrivacyState(): McsStevePrivacyState {
  return {
    policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
    status: 'active',
    withdrawnAt: null,
    sponsorConsent: Object.fromEntries(
      MCS_STEVE_SPONSOR_CONSENT_FIELDS.map((field) => [field, emptyGrant(field)]),
    ) as McsStevePrivacyState['sponsorConsent'],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function normalizeStevePrivacyState(value: unknown): McsStevePrivacyState {
  const base = defaultStevePrivacyState();
  if (!isObject(value)) return base;

  const status = value.status === 'withdrawn' ? 'withdrawn' : 'active';
  const rawConsent = isObject(value.sponsorConsent) ? value.sponsorConsent : {};
  const sponsorConsent = Object.fromEntries(
    MCS_STEVE_SPONSOR_CONSENT_FIELDS.map((field) => {
      const raw = isObject(rawConsent[field]) ? rawConsent[field] : {};
      return [
        field,
        {
          field,
          granted: status === 'active' && raw.granted === true,
          sponsorTmagId: nullableString(raw.sponsorTmagId),
          grantedAt: nullableString(raw.grantedAt),
          revokedAt: nullableString(raw.revokedAt),
        },
      ];
    }),
  ) as McsStevePrivacyState['sponsorConsent'];

  return {
    policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
    status,
    withdrawnAt: status === 'withdrawn' ? nullableString(value.withdrawnAt) : null,
    sponsorConsent,
  };
}

export function effectiveStevePrivacyState(
  state: McsStevePrivacyState,
  currentSponsorTmagId: string | null,
): McsStevePrivacyState {
  if (state.status === 'withdrawn') {
    return {
      ...state,
      sponsorConsent: Object.fromEntries(
        MCS_STEVE_SPONSOR_CONSENT_FIELDS.map((field) => [
          field,
          { ...state.sponsorConsent[field], granted: false },
        ]),
      ) as McsStevePrivacyState['sponsorConsent'],
    };
  }

  return {
    ...state,
    sponsorConsent: Object.fromEntries(
      MCS_STEVE_SPONSOR_CONSENT_FIELDS.map((field) => {
        const grant = state.sponsorConsent[field];
        const granted =
          grant.granted &&
          !!currentSponsorTmagId &&
          grant.sponsorTmagId === currentSponsorTmagId;
        return [field, { ...grant, granted }];
      }),
    ) as McsStevePrivacyState['sponsorConsent'],
  };
}

export function effectiveSteveSponsorConsentFields(
  state: McsStevePrivacyState,
  currentSponsorTmagId: string | null,
): McsSteveSponsorConsentField[] {
  const effective = effectiveStevePrivacyState(state, currentSponsorTmagId);
  return MCS_STEVE_SPONSOR_CONSENT_FIELDS.filter(
    (field) => effective.sponsorConsent[field].granted,
  );
}

async function getCurrentSponsorTmagId(tmagId: string): Promise<string | null> {
  const result = await persistenceCall<{ documents: MemberSponsor[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: 'team_magnificent_members',
    filter: { tmagId },
    projection: { sponsorTmagId: 1 },
    limit: 1,
  });
  const member = result.documents[0];
  if (!member) {
    throw new StevePrivacyError('NO_BA', 'No matching Brand Ambassador record.');
  }
  return member.sponsorTmagId ?? null;
}

async function getPrivacyDiscovery(tmagId: string): Promise<PersistedPrivacyDiscovery> {
  const result = await persistenceCall<{ documents: PersistedPrivacyDiscovery[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: { tmagId },
      projection: { _id: 1, tmagId: 1, completedAt: 1, privacy: 1 },
      limit: 1,
    },
  );
  const discovery = result.documents[0];
  if (!discovery) {
    throw new StevePrivacyError('NO_PROFILE', 'No completed Steve profile.');
  }
  return discovery;
}

async function writePrivacyProjection(
  discoveryId: string,
  tmagId: string,
  completedAt: string | null,
  state: McsStevePrivacyState,
): Promise<void> {
  const consentedFieldCount = MCS_STEVE_SPONSOR_CONSENT_FIELDS.filter(
    (field) => state.sponsorConsent[field].granted,
  ).length;

  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
      'SET d.privacyStatus = $privacyStatus, ' +
      'd.privacyPolicyVersion = $policyVersion, ' +
      'd.consentedFieldCount = $consentedFieldCount',
    params: {
      discoveryId,
      privacyStatus: state.status,
      policyVersion: state.policyVersion,
      consentedFieldCount,
    },
  });
  await persistenceCall('chromadb', 'add', {
    collection: CHROMA_DISCOVERIES,
    ids: [discoveryId],
    documents: [
      'Private Steve discovery completion marker. Profile content is canonical in MongoDB.',
    ],
    metadatas: [
      {
        discoveryId,
        ownerTmagId: tmagId,
        completedAt: completedAt ?? '',
        kind: 'steve_discovery',
        retrievalEligible: false,
        privacyStatus: state.status,
        privacyPolicyVersion: state.policyVersion,
        consentedFieldCount,
      },
    ],
  });
}

async function rollbackPrivacyState(args: {
  discovery: PersistedPrivacyDiscovery;
  state: McsStevePrivacyState;
}): Promise<void> {
  const update = await persistenceCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: DISCOVERIES_COLLECTION,
    filter: { _id: args.discovery._id, tmagId: args.discovery.tmagId },
    update: { $set: { privacy: args.state } },
  });
  if (update.matchedCount !== 1) {
    throw new StevePrivacyError(
      'ROLLBACK_FAILED',
      'Steve privacy rollback did not match the canonical record.',
    );
  }
  await writePrivacyProjection(
    args.discovery._id,
    args.discovery.tmagId,
    args.discovery.completedAt ?? null,
    args.state,
  );
  const readback = await getPrivacyDiscovery(args.discovery.tmagId);
  if (
    JSON.stringify(normalizeStevePrivacyState(readback.privacy)) !==
    JSON.stringify(args.state)
  ) {
    throw new StevePrivacyError(
      'ROLLBACK_FAILED',
      'Steve privacy rollback did not read back.',
    );
  }
}

async function persistPrivacyState(args: {
  discovery: PersistedPrivacyDiscovery;
  previous: McsStevePrivacyState;
  next: McsStevePrivacyState;
}): Promise<void> {
  const update = await persistenceCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: DISCOVERIES_COLLECTION,
    filter: { _id: args.discovery._id, tmagId: args.discovery.tmagId },
    update: { $set: { privacy: args.next } },
  });
  if (update.matchedCount !== 1) {
    throw new StevePrivacyError('WRITE_FAILED', 'Steve privacy state did not update.');
  }

  try {
    await writePrivacyProjection(
      args.discovery._id,
      args.discovery.tmagId,
      args.discovery.completedAt ?? null,
      args.next,
    );
  } catch (err) {
    try {
      await rollbackPrivacyState({
        discovery: args.discovery,
        state: args.previous,
      });
    } catch {
      // The original projection failure remains authoritative. Reconciliation
      // tooling will surface any rollback projection failure without exposing
      // private content here.
    }
    throw err;
  }

  const readback = await getPrivacyDiscovery(args.discovery.tmagId);
  const readbackState = normalizeStevePrivacyState(readback.privacy);
  if (JSON.stringify(readbackState) !== JSON.stringify(args.next)) {
    try {
      await rollbackPrivacyState({
        discovery: args.discovery,
        state: args.previous,
      });
    } catch {
      // Preserve the read-back failure as the caller-visible error. Store
      // reconciliation will surface any rollback failure without copying
      // private profile content into logs or error bodies.
    }
    throw new StevePrivacyError('READBACK_FAILED', 'Steve privacy state did not read back.');
  }
}

export async function getStevePrivacyState(tmagId: string): Promise<{
  privacy: McsStevePrivacyState;
  currentSponsorTmagId: string | null;
}> {
  const [discovery, currentSponsorTmagId] = await Promise.all([
    getPrivacyDiscovery(tmagId),
    getCurrentSponsorTmagId(tmagId),
  ]);
  return {
    privacy: effectiveStevePrivacyState(
      normalizeStevePrivacyState(discovery.privacy),
      currentSponsorTmagId,
    ),
    currentSponsorTmagId,
  };
}

export async function setSteveSponsorConsent(args: {
  tmagId: string;
  field: McsSteveSponsorConsentField;
  granted: boolean;
}): Promise<{
  privacy: McsStevePrivacyState;
  currentSponsorTmagId: string | null;
  auditEntryId: string;
}> {
  const [discovery, currentSponsorTmagId] = await Promise.all([
    getPrivacyDiscovery(args.tmagId),
    getCurrentSponsorTmagId(args.tmagId),
  ]);
  const previous = normalizeStevePrivacyState(discovery.privacy);
  if (previous.status === 'withdrawn' && args.granted) {
    throw new StevePrivacyError(
      'WITHDRAWN',
      'Sponsor sharing cannot be enabled while personalization is withdrawn.',
    );
  }
  if (args.granted && !currentSponsorTmagId) {
    throw new StevePrivacyError(
      'NO_CURRENT_SPONSOR',
      'Sponsor sharing requires a current direct sponsor.',
    );
  }

  const now = new Date().toISOString();
  const priorGrant = previous.sponsorConsent[args.field];
  const nextGrant: McsSteveSponsorConsentGrant = args.granted
    ? {
        field: args.field,
        granted: true,
        sponsorTmagId: currentSponsorTmagId,
        grantedAt: now,
        revokedAt: null,
      }
    : {
        field: args.field,
        granted: false,
        sponsorTmagId: priorGrant.sponsorTmagId ?? currentSponsorTmagId,
        grantedAt: priorGrant.grantedAt,
        revokedAt: now,
      };
  const next: McsStevePrivacyState = {
    ...previous,
    sponsorConsent: {
      ...previous.sponsorConsent,
      [args.field]: nextGrant,
    },
  };

  await persistPrivacyState({ discovery, previous, next });
  let audit;
  try {
    audit = await appendAuditEntry({
      actor: { kind: 'ba', tmagId: args.tmagId, displayName: args.tmagId },
      action: 'ba.steve_profile.consent_changed',
      entity: {
        kind: 'brand_ambassador',
        id: args.tmagId,
        displayLabel: 'Steve privacy controls',
      },
      severity: 'info',
      before: {
        policyVersion: previous.policyVersion,
        field: args.field,
        granted: priorGrant.granted,
      },
      after: {
        policyVersion: next.policyVersion,
        field: args.field,
        granted: nextGrant.granted,
      },
    });
  } catch (err) {
    try {
      await rollbackPrivacyState({ discovery, state: previous });
    } catch {
      // The audit failure remains authoritative and contains no private content.
    }
    throw err;
  }

  return {
    privacy: effectiveStevePrivacyState(next, currentSponsorTmagId),
    currentSponsorTmagId,
    auditEntryId: audit.entryId,
  };
}

export async function withdrawStevePersonalization(tmagId: string): Promise<{
  privacy: McsStevePrivacyState;
  currentSponsorTmagId: string | null;
  auditEntryId: string;
}> {
  const [discovery, currentSponsorTmagId] = await Promise.all([
    getPrivacyDiscovery(tmagId),
    getCurrentSponsorTmagId(tmagId),
  ]);
  const previous = normalizeStevePrivacyState(discovery.privacy);
  const now = new Date().toISOString();
  const next: McsStevePrivacyState = {
    policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
    status: 'withdrawn',
    withdrawnAt: previous.withdrawnAt ?? now,
    sponsorConsent: Object.fromEntries(
      MCS_STEVE_SPONSOR_CONSENT_FIELDS.map((field) => {
        const prior = previous.sponsorConsent[field];
        return [
          field,
          {
            ...prior,
            granted: false,
            revokedAt: prior.granted ? now : prior.revokedAt,
          },
        ];
      }),
    ) as McsStevePrivacyState['sponsorConsent'],
  };

  await persistPrivacyState({ discovery, previous, next });
  let audit;
  try {
    audit = await appendAuditEntry({
      actor: { kind: 'ba', tmagId, displayName: tmagId },
      action: 'ba.steve_profile.withdrawn',
      entity: {
        kind: 'brand_ambassador',
        id: tmagId,
        displayLabel: 'Steve privacy controls',
      },
      severity: 'info',
      before: {
        policyVersion: previous.policyVersion,
        privacyStatus: previous.status,
        sharedFieldCount: effectiveSteveSponsorConsentFields(
          previous,
          currentSponsorTmagId,
        ).length,
      },
      after: {
        policyVersion: next.policyVersion,
        privacyStatus: next.status,
        sharedFieldCount: 0,
      },
    });
  } catch (err) {
    try {
      await rollbackPrivacyState({ discovery, state: previous });
    } catch {
      // The audit failure remains authoritative and contains no private content.
    }
    throw err;
  }

  return {
    privacy: effectiveStevePrivacyState(next, currentSponsorTmagId),
    currentSponsorTmagId,
    auditEntryId: audit.entryId,
  };
}

export async function exportStevePrivateRecord(tmagId: string): Promise<{
  export: McsStevePrivateExport;
  auditEntryId: string;
}> {
  const result = await persistenceCall<{ documents: PersistedPrivacyDiscovery[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: { tmagId },
      projection: {
        _id: 1,
        tmagId: 1,
        startedAt: 1,
        completedAt: 1,
        transcript: 1,
        answers: 1,
        successProfile: 1,
        privacy: 1,
      },
      limit: 1,
    },
  );
  const discovery = result.documents[0];
  if (
    !discovery ||
    !discovery.successProfile ||
    !Array.isArray(discovery.transcript) ||
    !Array.isArray(discovery.answers)
  ) {
    throw new StevePrivacyError('NO_PROFILE', 'No completed Steve profile.');
  }
  const currentSponsorTmagId = await getCurrentSponsorTmagId(tmagId);
  const exportedAt = new Date().toISOString();
  const exportRecord: McsStevePrivateExport = {
    policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
    exportedAt,
    tmagId,
    startedAt: discovery.startedAt ?? null,
    completedAt: discovery.completedAt ?? null,
    transcript: discovery.transcript,
    answers: discovery.answers,
    successProfile: discovery.successProfile,
    privacy: effectiveStevePrivacyState(
      normalizeStevePrivacyState(discovery.privacy),
      currentSponsorTmagId,
    ),
  };
  const audit = await appendAuditEntry({
    actor: { kind: 'ba', tmagId, displayName: tmagId },
    action: 'ba.steve_profile.exported',
    entity: {
      kind: 'brand_ambassador',
      id: tmagId,
      displayLabel: 'Steve private record',
    },
    severity: 'info',
    after: {
      policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
      artifactId: discovery._id,
      exportedFields: ['transcript', 'answers', 'successProfile', 'privacy'],
    },
  });
  return { export: exportRecord, auditEntryId: audit.entryId };
}
