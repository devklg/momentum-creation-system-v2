import type { McsResourceLifecycleState } from './resource-lifecycle.js';
import type {
  McsHoldingTankSnapshot,
  McsIsoTimestamp,
  McsPlaceProspectResult,
  McsPlacementTickerEntry,
  McsPoolPlacement,
  McsResolvedTokenPayload,
  McsVideoEventKind,
  McsVideoEventPayload,
  McsVideoEventResponse,
  McsWebinarEvent,
} from './types.js';

/**
 * Additive Konga Line contract family approved by ACR-0034.
 *
 * Legacy placement, snapshot, and presentation-video contracts remain
 * unchanged. Consumers opt into this family through contractVersion.
 */
export const MCS_KONGA_CONTRACT_VERSION = 'konga-v1' as const;

export type McsKongaContractVersion = typeof MCS_KONGA_CONTRACT_VERSION;

export interface McsKongaAddedBy {
  firstName: string;
  lastInitial: string;
}

/** Public placement projection. Legacy placements explicitly project null. */
export type McsKongaPlacementTickerEntry = McsPlacementTickerEntry & {
  addedBy: McsKongaAddedBy | null;
};

/**
 * Internal attempt identity. placementAttemptId is derived from the immutable
 * invitation record id; it is never a raw invite token.
 */
export interface McsKongaPlacementIdentity {
  placementId: string;
  placementAttemptId: string;
}

/**
 * Governed stored placement shape for new Konga attempts.
 * A fresh attempt may be created only after the prior live placement flushes.
 */
export type McsKongaPoolPlacement = McsPoolPlacement &
  McsKongaPlacementIdentity & {
    addedBy: McsKongaAddedBy;
  };

/**
 * Placement command outcome. alreadyPlaced=true means the same immutable
 * invitation attempt was replayed; it is not a newly created position.
 */
export type McsKongaPlaceProspectResult = McsPlaceProspectResult &
  McsKongaPlacementIdentity & {
    contractVersion: McsKongaContractVersion;
  };

export type McsKongaPlacementEvent = McsKongaPlacementTickerEntry & {
  contractVersion: McsKongaContractVersion;
  /** Globally unique and shared with the SSE id field. */
  eventId: string;
};

/** Public, content-minimized event emitted only after governed join read-back. */
export interface McsJoinEvent {
  contractVersion: McsKongaContractVersion;
  eventId: string;
  positionNumber: number;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  addedBy: McsKongaAddedBy | null;
  joinedAt: McsIsoTimestamp;
}

/**
 * Versioned snapshot. pageVisitId identifies one top-level visit and must be
 * reused by automatic resolve retries and EventSource reconnects.
 */
export type McsKongaHoldingTankSnapshot =
  Omit<McsHoldingTankSnapshot, 'recent'> & {
    contractVersion: McsKongaContractVersion;
    recent: McsKongaPlacementTickerEntry[];
    placementsThisWeek: number;
    geoSpreadCount: number;
    nextWebinar: McsWebinarEvent | null;
    sinceLastVisit: number | null;
    pageVisitId: string;
  };

export interface McsKongaPageVisitRequest {
  /** Client-created UUID; telemetry correlation only and never access authority. */
  pageVisitId: string;
}

export type McsKongaResolveRequest = McsKongaPageVisitRequest;
export type McsKongaStreamRequest = McsKongaPageVisitRequest;

export interface McsWebinarReplay {
  contractVersion: McsKongaContractVersion;
  /** Past webinar event represented by this replay. */
  eventId: string;
  /** Immutable ACR-0033 catalog version; never a mutable media URL. */
  resourceVersionId: string;
  recordedAt: McsIsoTimestamp;
  availableAt: McsIsoTimestamp;
  /** Honest, preformatted date label shown with the recording. */
  displayDate: string;
  publicationStatus: McsResourceLifecycleState;
}

export type McsKongaVideoEventKind = McsVideoEventKind | 'replay_complete';

/**
 * replay_complete is replay-scoped and cannot enter the presentation placement
 * branch. The immutable resource binding makes that distinction explicit.
 */
export type McsKongaVideoEventPayload =
  | McsVideoEventPayload
  | {
      kind: 'replay_complete';
      replayEventId: string;
      resourceVersionId: string;
    };

export interface McsKongaReplayCompletion {
  replayEventId: string;
  resourceVersionId: string;
  completedAt: McsIsoTimestamp;
}

export type McsKongaVideoEventResponse = McsVideoEventResponse & {
  contractVersion: McsKongaContractVersion;
  replayCompletion: McsKongaReplayCompletion | null;
};

export type McsKongaResolvedTokenPayload = McsResolvedTokenPayload & {
  contractVersion: McsKongaContractVersion;
  pageVisitId: string;
  replay: McsWebinarReplay | null;
};

export type McsKongaStreamEventName =
  | 'snapshot'
  | 'placement'
  | 'join'
  | 'ping';

export type McsKongaStreamEvent =
  | {
      event: 'snapshot';
      id: null;
      data: McsKongaHoldingTankSnapshot;
    }
  | {
      event: 'placement';
      id: string;
      data: McsKongaPlacementEvent;
    }
  | {
      event: 'join';
      id: string;
      data: McsJoinEvent;
    }
  | {
      event: 'ping';
      id: null;
      data: { at: McsIsoTimestamp };
    };

export type McsMissionFunnelEventKind =
  | 'signup'
  | 'two_in_72_achieved'
  | 'first_invite'
  | 'duplication_depth';

interface McsMissionFunnelEventBase {
  contractVersion: McsKongaContractVersion;
  eventId: string;
  baTmagId: string;
  occurredAt: McsIsoTimestamp;
  /** Mission instrumentation is observation only, never scoring or ranking. */
  reportOnly: true;
}

export interface McsMissionFunnelSignupEvent
  extends McsMissionFunnelEventBase {
  kind: 'signup';
  signupAt: McsIsoTimestamp;
  sourceAuthority: 'team_magnificent_members.createdAt';
}

export interface McsMissionFunnelFirstInviteEvent
  extends McsMissionFunnelEventBase {
  kind: 'first_invite';
  firstInviteAt: McsIsoTimestamp;
  sourceAuthority: 'invitation_activity.invitation_sent';
}

export interface McsMissionFunnelTwoIn72Event
  extends McsMissionFunnelEventBase {
  kind: 'two_in_72_achieved';
  signupAt: McsIsoTimestamp;
  achievedAt: McsIsoTimestamp;
  attestedEnrollmentCount: 2;
  sourceAuthority: 'attested_enrollment_relationships';
}

export interface McsMissionFunnelDuplicationDepthEvent
  extends McsMissionFunnelEventBase {
  kind: 'duplication_depth';
  computedAt: McsIsoTimestamp;
  depth: number;
  sourceAuthority: 'attested_enrollment_relationships';
}

export type McsMissionFunnelEvent =
  | McsMissionFunnelSignupEvent
  | McsMissionFunnelFirstInviteEvent
  | McsMissionFunnelTwoIn72Event
  | McsMissionFunnelDuplicationDepthEvent;

export interface McsMissionFunnelReportResponse {
  ok: true;
  contractVersion: McsKongaContractVersion;
  generatedAt: McsIsoTimestamp;
  reportOnly: true;
  events: McsMissionFunnelEvent[];
}

/** Shared line component lens: one collective stream, contextual head only. */
export interface McsKongaLineLens {
  head: 'sponsor' | 'self';
}

export interface McsKongaLaunchProgress {
  signupAt: McsIsoTimestamp;
  deadlineAt: McsIsoTimestamp;
  completedCount: 0 | 1 | 2;
  achievedAt: McsIsoTimestamp | null;
  effortBased: true;
}

export interface McsKongaInviterLeaderboardEntry {
  firstName: string;
  lastInitial: string;
  addsCount: number;
}

export interface McsKongaTeamLensResponse {
  ok: true;
  contractVersion: McsKongaContractVersion;
  lens: { head: 'self' };
  hasFirstInvite: boolean;
  launchProgress: McsKongaLaunchProgress;
  leaderboard: {
    visibility: 'members_only';
    entries: McsKongaInviterLeaderboardEntry[];
  };
}

/**
 * Authenticated `.team` Konga contracts. Kept separate from the prospect
 * token contracts so members-only state cannot be serialized by `/api/p` or
 * `/api/rvm` accidentally.
 */
export interface McsKongaTeamGenesisNode {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  invitedAt: McsIsoTimestamp;
  /** A confirmed invitation is genesis, not a holding-tank placement. */
  positionNumber: null;
  sourceAuthority: 'invitation_activity.invitation_sent';
}

export interface McsKongaTeamPlacementSnapshot {
  globalMaxPosition: number;
  recent: McsKongaPlacementTickerEntry[];
  placementsThisWeek: number;
  geoSpreadCount: number;
}

export interface McsKongaTeamSnapshotResponse {
  ok: true;
  contractVersion: McsKongaContractVersion;
  lens: { head: 'self' };
  head: McsKongaAddedBy;
  hasFirstInvite: boolean;
  genesis: McsKongaTeamGenesisNode | null;
  launchProgress: McsKongaLaunchProgress;
  placementSnapshot: McsKongaTeamPlacementSnapshot;
}

export interface McsKongaTeamLeaderboardResponse {
  ok: true;
  contractVersion: McsKongaContractVersion;
  visibility: 'members_only';
  /** ACR-0034 does not authorize an arbitrary period; adds are lifetime. */
  period: 'lifetime';
  sourceAuthority: 'tmag_prospect_htank_placements';
  entries: McsKongaInviterLeaderboardEntry[];
}

export type McsKongaTeamStreamEvent =
  | {
      event: 'snapshot';
      id: null;
      data: McsKongaTeamSnapshotResponse;
    }
  | {
      event: 'placement';
      id: string;
      data: McsKongaPlacementEvent;
    }
  | {
      event: 'join';
      id: string;
      data: McsJoinEvent;
    }
  | {
      event: 'ping';
      id: null;
      data: { at: McsIsoTimestamp };
    };
