import type { TmagId, McsRequestId, McsSessionId, McsTeamId, McsTenantId } from './ids.js';

export type McsRuntimeEnvironment = 'development' | 'staging' | 'production';

export type McsTeamMagnificentTeamKey = 'team_magnificent';
export type McsTeamMagnificentTeamName = 'Team Magnificent';

export interface McsTenantRuntimeScope {
  tenantId: McsTenantId;
  teamId?: never;
  teamKey?: never;
  teamName?: never;
  tmagId?: never;
}

export interface McsTeamMagnificentScope {
  tenantId: McsTenantId;
  teamId: McsTeamId;
  teamKey: McsTeamMagnificentTeamKey;
  teamName: McsTeamMagnificentTeamName;
  tmagId?: never;
}

export interface McsBaRuntimeScope {
  tenantId: McsTenantId;
  teamId: McsTeamId;
  teamKey: McsTeamMagnificentTeamKey;
  teamName: McsTeamMagnificentTeamName;
  tmagId: TmagId;
}

export type McsRuntimeScope = McsTenantRuntimeScope | McsTeamMagnificentScope | McsBaRuntimeScope;

export type McsRuntimeRequestScope = McsRuntimeScope & {
  requestId?: McsRequestId;
  sessionId?: McsSessionId;
};

export interface McsTenantContext {
  tenantId: McsTenantId;
  tenantName: string;
  brandName: string;
  environment: McsRuntimeEnvironment;
}

export interface McsTeamContext {
  teamId: McsTeamId;
  teamKey: McsTeamMagnificentTeamKey;
  teamName: McsTeamMagnificentTeamName;
}

export interface McsBaPermissions {
  canUsePrivateJournal: boolean;
  canSelectJournalForReview: boolean;
  canCreateKnowledgeCandidate: boolean;
  canAccessRelationshipContext: boolean;
  canUseBrowserVoice: boolean;
  canUseBrowserText: boolean;
}

export interface McsBaContext extends McsBaRuntimeScope {
  displayName?: string;
  preferredName?: string;
  timezone?: string;
  onboardingState?: string;
  journalEnabled: boolean;
  languagePreference: import('./language.js').McsRuntimeLanguage;
  permissions: McsBaPermissions;
  profileSummary?: string;
  successProfileAvailable?: boolean;
  trainingProfileAvailable?: boolean;
  relationshipProfileAvailable?: boolean;
}
