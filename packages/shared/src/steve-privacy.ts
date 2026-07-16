import type {
  McsSteveDiscoveryAnswer,
  McsSteveSuccessProfile,
  McsSteveTranscriptChunk,
} from './types.js';

export const MCS_STEVE_PRIVACY_POLICY_VERSION = 'acr-0031.v1' as const;

export const MCS_STEVE_SPONSOR_CONSENT_FIELDS = [
  'why_statement',
  'success_vision',
  'support_obstacles',
  'michael_handoff_summary',
] as const;

export type McsSteveSponsorConsentField =
  (typeof MCS_STEVE_SPONSOR_CONSENT_FIELDS)[number];

export type McsStevePrivacyStatus = 'active' | 'withdrawn';

export interface McsSteveSponsorConsentGrant {
  field: McsSteveSponsorConsentField;
  granted: boolean;
  sponsorTmagId: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}

export interface McsStevePrivacyState {
  policyVersion: typeof MCS_STEVE_PRIVACY_POLICY_VERSION;
  status: McsStevePrivacyStatus;
  withdrawnAt: string | null;
  sponsorConsent: Record<
    McsSteveSponsorConsentField,
    McsSteveSponsorConsentGrant
  >;
}

export const MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY =
  'Share this field with my current direct sponsor so they can support my training. I can turn sharing off later. This does not share my transcript, raw answers, audio, or the rest of my Success Profile.' as const;

export const MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY =
  'Stop sharing this field with my direct sponsor. The sponsor view will remove it; a content-free audit fact will remain.' as const;

export const MCS_STEVE_WITHDRAW_CONFIRMATION =
  'WITHDRAW STEVE PERSONALIZATION' as const;

export interface McsStevePrivacyResponse {
  ok: true;
  privacy: McsStevePrivacyState;
  currentSponsorTmagId: string | null;
  grantCopy: typeof MCS_STEVE_SPONSOR_CONSENT_GRANT_COPY;
  revocationCopy: typeof MCS_STEVE_SPONSOR_CONSENT_REVOCATION_COPY;
}

export interface McsSteveSponsorConsentPayload {
  field: McsSteveSponsorConsentField;
  granted: boolean;
}

export interface McsSteveSponsorConsentResponse extends McsStevePrivacyResponse {
  auditEntryId: string;
}

export interface McsSteveWithdrawPayload {
  confirmation: typeof MCS_STEVE_WITHDRAW_CONFIRMATION;
}

export interface McsSteveWithdrawResponse extends McsStevePrivacyResponse {
  auditEntryId: string;
}

export interface McsStevePrivateExport {
  policyVersion: typeof MCS_STEVE_PRIVACY_POLICY_VERSION;
  exportedAt: string;
  tmagId: string;
  startedAt: string | null;
  completedAt: string | null;
  transcript: McsSteveTranscriptChunk[];
  answers: McsSteveDiscoveryAnswer[];
  successProfile: McsSteveSuccessProfile;
  privacy: McsStevePrivacyState;
}

export interface McsStevePrivateExportResponse {
  ok: true;
  export: McsStevePrivateExport;
  auditEntryId: string;
}
