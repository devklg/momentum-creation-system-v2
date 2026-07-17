/**
 * RVM token resolver and lifecycle bridge.
 *
 * RVM uses a separate prospect entry route, but the mechanics stay aligned
 * with PMV: token resolve, video milestone tracking, and holding-tank
 * placement only at video_complete.
 */

import type {
  McsRvmResolvedTokenPayload,
  McsTokenState,
  McsVideoEventKind,
  McsVideoEventResponse,
} from '@momentum/shared';
import {
  findTokenRecord,
  isTokenExpired,
  markTokenOpened,
  transitionTokenState,
} from './tokens.js';
import { findProspectById, lastInitialOf } from './prospects.js';
import { findBAByTmagId } from './ba.js';
import { findBulkLeadByToken } from './bulkLeads.js';
import {
  applyCrmLifecycleEvent,
  createOrUpdateCrmRecordForToken,
  findCrmRecordByProspectId,
} from './prospectCrm.js';
import { placeKongaProspect } from './kongaPlacement.js';
import { findNextUpcomingEvent } from './webinarEvent.js';

const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/1IZiV7RXdCY';
const WEBINAR = {
  dayOfWeek: 'Mondays & Thursdays',
  timeOfDay: '5:00 PM',
  timezone: 'America/Los_Angeles',
};

const KIND_TO_STATE: Record<McsVideoEventKind, McsTokenState> = {
  started: 'video_started',
  quarter: 'video_quarter',
  half: 'video_half',
  three_quarter: 'video_three_quarter',
  complete: 'video_complete',
};

const KIND_TO_TIMELINE: Record<McsVideoEventKind, Parameters<typeof applyCrmLifecycleEvent>[1]> = {
  started: 'presentation_started',
  quarter: 'presentation_25',
  half: 'presentation_50',
  three_quarter: 'presentation_75',
  complete: 'presentation_completed',
};

export class RvmTokenError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'RvmTokenError';
  }
}

export async function resolveRvmToken(token: string): Promise<McsRvmResolvedTokenPayload> {
  const bulkLead = await findBulkLeadByToken(token);
  if (!bulkLead) throw new RvmTokenError('invalid_token');

  const tokenRecord = await findTokenRecord(token);
  if (!tokenRecord) throw new RvmTokenError('invalid_token');
  if (tokenRecord.state === 'enrolled') throw new RvmTokenError('enrolled');
  if (tokenRecord.state === 'expired') throw new RvmTokenError('expired');
  if (isTokenExpired(tokenRecord)) {
    await transitionTokenState(token, 'expired');
    throw new RvmTokenError('expired');
  }

  const open = await markTokenOpened(token);
  const [prospect, ba, nextEvent] = await Promise.all([
    findProspectById(tokenRecord.prospectId),
    findBAByTmagId(tokenRecord.sponsorTmagId),
    findNextUpcomingEvent(),
  ]);
  if (!prospect || !ba) throw new RvmTokenError('invalid_token');

  let crm = await findCrmRecordByProspectId(prospect.prospectId);
  if (!crm) {
    crm = await createOrUpdateCrmRecordForToken({
      prospectId: prospect.prospectId,
      token,
      ownerTmagId: bulkLead.ownerTmagId,
      sponsorTmagId: bulkLead.sponsorTmagId,
      source: 'rvm',
      leadId: bulkLead.leadId,
      leadOwnerId: bulkLead.leadOwnerId,
      vmCampaignId: bulkLead.vmCampaignId,
    });
  }

  if (open.changed) {
    await applyCrmLifecycleEvent(prospect.prospectId, 'link_clicked', 'RVM token link clicked.', {
      token,
      leadId: bulkLead.leadId,
    });
    crm = await applyCrmLifecycleEvent(
      prospect.prospectId,
      'activated',
      'RVM lead activated by link click.',
      { token, leadId: bulkLead.leadId },
    );
  }

  return {
    token,
    state: open.state,
    source: 'rvm',
    prospect: {
      firstName: prospect.firstName,
      lastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
      city: prospect.location.city,
      stateOrRegion: prospect.location.stateOrRegion,
      country: prospect.location.country,
      positionNumber: prospect.positionNumber,
      placedAt: prospect.placedAt,
      expiresAt: prospect.expiresAt,
    },
    ba: {
      tmagId: ba.tmagId,
      firstName: ba.firstName,
      lastName: ba.lastName,
      lastInitial: ba.lastName.charAt(0).toUpperCase(),
      fullName: `${ba.firstName} ${ba.lastName}`,
    },
    videoUrl: DR_DAN_VIDEO_URL,
    webinar: WEBINAR,
    nextEvent: nextEvent
      ? {
          eventId: nextEvent.eventId,
          scheduledFor: nextEvent.scheduledFor,
          hosts: nextEvent.hosts,
        }
      : null,
    lead: {
      leadId: bulkLead.leadId,
      leadOwnerId: bulkLead.leadOwnerId,
      vmCampaignId: bulkLead.vmCampaignId,
      status: bulkLead.status,
    },
    crm: {
      crmRecordId: crm.crmRecordId,
      crmStatus: crm.status,
      disposition: crm.disposition,
    },
  };
}

export async function recordRvmVideoEvent(
  token: string,
  kind: McsVideoEventKind,
): Promise<McsVideoEventResponse> {
  const bulkLead = await findBulkLeadByToken(token);
  if (!bulkLead) throw new RvmTokenError('invalid_token');

  const tokenRecord = await findTokenRecord(token);
  if (!tokenRecord) throw new RvmTokenError('invalid_token');
  if (tokenRecord.state === 'enrolled') throw new RvmTokenError('enrolled');
  if (tokenRecord.state === 'expired') throw new RvmTokenError('expired');
  if (isTokenExpired(tokenRecord)) {
    await transitionTokenState(token, 'expired');
    throw new RvmTokenError('expired');
  }

  const transition = await transitionTokenState(token, KIND_TO_STATE[kind]);
  const prospect = await findProspectById(tokenRecord.prospectId);
  if (!prospect) throw new RvmTokenError('invalid_token');

  let positionNumber: number | null = prospect.positionNumber;
  let placedAt: string | null = prospect.placedAt;

  if (transition.changed) {
    await applyCrmLifecycleEvent(
      prospect.prospectId,
      KIND_TO_TIMELINE[kind],
      `RVM presentation milestone: ${kind}.`,
      { token, leadId: bulkLead.leadId },
    );
  }

  if (kind === 'complete') {
    const result = await placeKongaProspect({
      prospectId: prospect.prospectId,
      sponsorTmagId: tokenRecord.sponsorTmagId,
      invitationRecordId: tokenRecord.token,
      prospectExpiresAt: prospect.expiresAt,
      firstName: prospect.firstName,
      lastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
      city: prospect.location.city,
      stateOrRegion: prospect.location.stateOrRegion,
    });
    positionNumber = result.positionNumber;
    placedAt = result.placedAt;

    if (!result.alreadyPlaced) {
      await applyCrmLifecycleEvent(
        prospect.prospectId,
        'holding_tank',
        'RVM prospect entered the holding tank after video completion.',
        { token, leadId: bulkLead.leadId, positionNumber: result.positionNumber },
      );
    }
  }

  return {
    token,
    state: transition.state,
    positionNumber,
    placedAt,
  };
}

export async function activateRvmLeadByToken(
  token: string,
  note: string,
): Promise<{ prospectId: string; createdAt: string }> {
  const bulkLead = await findBulkLeadByToken(token);
  if (!bulkLead) throw new RvmTokenError('invalid_token');
  const tokenRecord = await findTokenRecord(token);
  if (!tokenRecord) throw new RvmTokenError('invalid_token');
  if (tokenRecord.state === 'enrolled') throw new RvmTokenError('enrolled');
  if (tokenRecord.state === 'expired' || isTokenExpired(tokenRecord)) {
    if (tokenRecord.state !== 'expired') await transitionTokenState(token, 'expired');
    throw new RvmTokenError('expired');
  }

  const event = await applyCrmLifecycleEvent(
    tokenRecord.prospectId,
    'activated',
    note,
    { token, leadId: bulkLead.leadId },
  );
  return { prospectId: event.prospectId, createdAt: event.updatedAt };
}
