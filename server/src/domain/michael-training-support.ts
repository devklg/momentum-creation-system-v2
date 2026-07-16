/**
 * Michael Training Support — sponsor-facing projection of Steve's SuccessProfile.
 *
 * READ-ONLY. This module owns no collections of its own. Steve (the new-BA
 * discovery agent) persists `tmag_steve_success_interview` with a SuccessProfile; this
 * module reads that artifact on demand and DERIVES a sponsor-facing training-
 * support card — "how to support this downline's training" — projecting the
 * BA's own discovery answers into actionable guidance for their direct sponsor.
 *
 * RELATIONSHIP TO STEVE: this module DOES NOT IMPLEMENT STEVE and never
 * mutates `tmag_steve_success_interview`. The user-prompt contract is "assume Steve
 * outputs SuccessProfile" — the SuccessProfile shape declared below is the
 * minimum surface this code reads. When Steve's branch lands, his canonical
 * @momentum/shared types will be the source of truth; the shape below is
 * structurally compatible so the Mongo read flows through unchanged.
 *
 * RELATIONSHIP TO MICHAEL: this is Michael's remaining BA-facing role. It
 * surfaces Steve's onboarding-discovery guidance as sponsor training support;
 * Michael does not schedule or conduct interviews.
 *
 * COMPLIANCE (locked-spec 3.10): BA-language read-back only. No earnings, no
 * cycle math, no placement promises. The Layer-1 frame Michael and Steve both
 * carry holds here too — the sponsor uses this card to meet the BA where they
 * are during training, not to project outcomes.
 *
 * SPONSOR AUTHORITY: enforced server-side, mirrors getProfileCardForSponsor
 * (steve-success-interview.ts).
 * — only the direct sponsor (downline.sponsorTmagId === requestingTmagId) can read.
 */

import type {
  McsMichaelTrainingSupportCard,
  McsMichaelTrainingSupportGuidanceSection,
  McsSteveSuccessProfile,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { isSafeSteveGuidanceText } from './steve-tailored-guidance.js';

/** Provenance literal stamped on the derived training-support card. */
export const MICHAEL_TRAINING_SUPPORT_SIGNED_BY =
  'Michael Training Support · derived from Steve Success Profile';

const STEVE_DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';

// ─────────────────────────────────────────────────────────────────────────
// Narrow local Steve shape (structural subset). Steve's own branch owns the
// canonical types; this declares only what THIS module reads. TypeScript's
// structural typing means a richer Steve type assigns into these without
// friction once Steve merges.
// ─────────────────────────────────────────────────────────────────────────

interface PersistedSteveDiscovery {
  _id: string;
  tmagId: string;
  sponsorTmagId: string | null;
  completedAt?: string | null;
  successProfile: McsSteveSuccessProfile;
}

interface TeamMagnificentMemberLookup {
  tmagId: string;
  sponsorTmagId?: string | null;
  firstName?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Errors — mirrors SponsorAccessError shape used by sibling cockpit reads so
// the route layer can branch on `code` the same way.
// ─────────────────────────────────────────────────────────────────────────

export class TrainingSupportAccessError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'TrainingSupportAccessError';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

async function getTeamMagnificentMember(tmagId: string): Promise<TeamMagnificentMemberLookup | null> {
  const result = await persistenceCall<{ documents: TeamMagnificentMemberLookup[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    projection: { tmagId: 1, sponsorTmagId: 1, firstName: 1 },
    limit: 1,
  });
  return result.documents[0] ?? null;
}

async function getSteveDiscoveryByTmagId(
  tmagId: string,
): Promise<PersistedSteveDiscovery | null> {
  const result = await persistenceCall<{ documents: PersistedSteveDiscovery[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: STEVE_DISCOVERIES_COLLECTION,
      filter: { tmagId },
      projection: {
        _id: 1,
        tmagId: 1,
        sponsorTmagId: 1,
        completedAt: 1,
        'successProfile.generatedAt': 1,
        'successProfile.primaryWhy.statement': 1,
        'successProfile.successVision.statement': 1,
        'successProfile.learningStyle.modalities': 1,
        'successProfile.learningStyle.feedbackPreference': 1,
        'successProfile.communicationPreferences.preferredChannels': 1,
        'successProfile.communicationPreferences.cadence': 1,
        'successProfile.communicationPreferences.bestTimes': 1,
        'successProfile.supportNeeds.areas': 1,
        'successProfile.supportNeeds.potentialObstacles': 1,
        'successProfile.supportNeeds.helpStyle': 1,
        'successProfile.trainingRecommendations.text': 1,
        'successProfile.michaelHandoffSummary': 1,
      },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────
// Derivation helpers
// ─────────────────────────────────────────────────────────────────────────

function trimToNonEmpty(s: string | null | undefined): string {
  if (typeof s !== 'string') return '';
  return s.trim();
}

function cleanList(items: string[] | null | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((s) => (typeof s === 'string' ? s.trim() : '')).filter((s) => s.length > 0);
}

function joinNatural(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function deriveLearningStyle(ls: McsSteveSuccessProfile['learningStyle']): McsMichaelTrainingSupportGuidanceSection {
  const modalities = cleanList(ls.modalities);
  const feedback = trimToNonEmpty(ls.feedbackPreference);
  const bullets: string[] = [];
  if (modalities.length > 0) bullets.push(`Learns best by: ${joinNatural(modalities)}.`);
  if (feedback) bullets.push(`Wants feedback: ${feedback}.`);
  return { label: 'How they learn', bullets };
}

function deriveCommunication(
  cp: McsSteveSuccessProfile['communicationPreferences'],
): McsMichaelTrainingSupportGuidanceSection {
  const channels = cleanList(cp.preferredChannels);
  const cadence = trimToNonEmpty(cp.cadence);
  const bestTimes = trimToNonEmpty(cp.bestTimes);
  const bullets: string[] = [];
  if (channels.length > 0) bullets.push(`Reach them by: ${joinNatural(channels)}.`);
  if (cadence) bullets.push(`Cadence that fits: ${cadence}.`);
  if (bestTimes) bullets.push(`Easiest to reach: ${bestTimes}.`);
  return { label: 'How to stay in touch', bullets };
}

function deriveSupportFocus(sn: McsSteveSuccessProfile['supportNeeds']): McsMichaelTrainingSupportGuidanceSection {
  const areas = cleanList(sn.areas);
  const obstacles = cleanList(sn.potentialObstacles);
  const helpStyle = trimToNonEmpty(sn.helpStyle);
  const bullets: string[] = [];
  if (areas.length > 0) bullets.push(`Where they want support early: ${joinNatural(areas)}.`);
  if (obstacles.length > 0) bullets.push(`They named: ${joinNatural(obstacles)}.`);
  if (helpStyle) bullets.push(`When stuck: ${helpStyle}.`);
  return { label: 'Where to focus your support', bullets };
}

/**
 * Project a SuccessProfile into a sponsor-facing training-support card. Pure;
 * no IO. Exported for unit-style reasoning and to keep the derivation rules in
 * one auditable place.
 */
export function projectSuccessProfileToCard(args: {
  downlineTmagId: string;
  downlineFirstName: string;
  profile: McsSteveSuccessProfile;
}): McsMichaelTrainingSupportCard {
  const p = args.profile;
  return {
    downlineTmagId: args.downlineTmagId,
    downlineFirstName: args.downlineFirstName,
    derivedFromSteveAt: p.generatedAt,
    primaryWhy: trimToNonEmpty(p.primaryWhy?.statement),
    successVision: trimToNonEmpty(p.successVision?.statement),
    learningStyle: deriveLearningStyle(p.learningStyle),
    communication: deriveCommunication(p.communicationPreferences),
    supportFocus: deriveSupportFocus(p.supportNeeds),
    trainingRecommendations: cleanList(
      p.trainingRecommendations
        .map((recommendation) => recommendation.text)
        .filter(isSafeSteveGuidanceText),
    ),
    michaelHandoffSummary: trimToNonEmpty(p.michaelHandoffSummary),
    signedBy: MICHAEL_TRAINING_SUPPORT_SIGNED_BY,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Sponsor-only read
// ─────────────────────────────────────────────────────────────────────────

/**
 * Sponsor-only fetch of a downline's Michael training-support card.
 * Authoritative check is server-side: requestingTmagId must equal the
 * downline's sponsorTmagId. Throws TrainingSupportAccessError with a `code`
 * the route layer maps to 403 / 404.
 *
 *   NO_DOWNLINE       → no BA record at all          (404)
 *   NOT_SPONSOR       → caller is not direct sponsor (403)
 *   NO_PROFILE        → no Steve discovery yet       (404)
 */
export async function getTrainingSupportCardForSponsor(args: {
  requestingTmagId: string;
  downlineTmagId: string;
}): Promise<McsMichaelTrainingSupportCard> {
  const downline = await getTeamMagnificentMember(args.downlineTmagId);
  if (!downline) {
    throw new TrainingSupportAccessError(
      'NO_DOWNLINE',
      `No BA record for downlineTmagId=${args.downlineTmagId}.`,
    );
  }
  if (!downline.sponsorTmagId || downline.sponsorTmagId !== args.requestingTmagId) {
    throw new TrainingSupportAccessError(
      'NOT_SPONSOR',
      'Only the direct sponsor can read this training-support card.',
    );
  }

  const discovery = await getSteveDiscoveryByTmagId(args.downlineTmagId);
  if (!discovery || !discovery.successProfile) {
    throw new TrainingSupportAccessError(
      'NO_PROFILE',
      'Steve discovery is not complete yet for this BA.',
    );
  }

  return projectSuccessProfileToCard({
    downlineTmagId: args.downlineTmagId,
    downlineFirstName: trimToNonEmpty(downline.firstName),
    profile: discovery.successProfile,
  });
}
