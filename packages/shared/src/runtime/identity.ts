import type { TmagId, RequestId, SessionId, TeamId, TenantId } from './ids.js';

export type RuntimeEnvironment = 'development' | 'staging' | 'production';

export type TeamMagnificentTeamKey = 'team_magnificent';
export type TeamMagnificentTeamName = 'Team Magnificent';

export interface TenantRuntimeScope {
  tenantId: TenantId;
  teamId?: never;
  teamKey?: never;
  teamName?: never;
  tmagId?: never;
}

export interface TeamMagnificentScope {
  tenantId: TenantId;
  teamId: TeamId;
  teamKey: TeamMagnificentTeamKey;
  teamName: TeamMagnificentTeamName;
  tmagId?: never;
}

export interface BaRuntimeScope {
  tenantId: TenantId;
  teamId: TeamId;
  teamKey: TeamMagnificentTeamKey;
  teamName: TeamMagnificentTeamName;
  tmagId: TmagId;
}

export type RuntimeScope = TenantRuntimeScope | TeamMagnificentScope | BaRuntimeScope;

export type RuntimeRequestScope = RuntimeScope & {
  requestId?: RequestId;
  sessionId?: SessionId;
};

export interface TenantContext {
  tenantId: TenantId;
  tenantName: string;
  brandName: string;
  environment: RuntimeEnvironment;
}

export interface TeamContext {
  teamId: TeamId;
  teamKey: TeamMagnificentTeamKey;
  teamName: TeamMagnificentTeamName;
}

export interface BaPermissions {
  canUsePrivateJournal: boolean;
  canSelectJournalForReview: boolean;
  canCreateKnowledgeCandidate: boolean;
  canAccessRelationshipContext: boolean;
  canUseBrowserVoice: boolean;
  canUseBrowserText: boolean;
}

export interface BaContext extends BaRuntimeScope {
  displayName?: string;
  preferredName?: string;
  timezone?: string;
  onboardingState?: string;
  journalEnabled: boolean;
  languagePreference: import('./language.js').RuntimeLanguage;
  permissions: BaPermissions;
  profileSummary?: string;
  successProfileAvailable?: boolean;
  trainingProfileAvailable?: boolean;
  relationshipProfileAvailable?: boolean;
}
