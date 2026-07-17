import { describe, expect, it } from 'vitest';
import {
  MCS_KONGA_CONTRACT_VERSION,
  MCS_KONGA_D23_CSS_VARIABLES,
  MCS_KONGA_D23_TOKENS,
  type McsJoinEvent,
  type McsKongaHoldingTankSnapshot,
  type McsKongaPlaceProspectResult,
  type McsKongaPlacementEvent,
  type McsKongaPlacementTickerEntry,
  type McsKongaStreamEvent,
  type McsKongaVideoEventPayload,
  type McsMissionFunnelEvent,
  type McsWebinarReplay,
} from '@momentum/shared';

const placedAt = '2026-07-17T12:00:00.000Z';

const placement: McsKongaPlacementTickerEntry = {
  positionNumber: 204,
  firstName: 'Test',
  lastInitial: 'P.',
  city: 'Pasadena',
  stateOrRegion: 'CA',
  placedAt,
  addedBy: null,
};

describe('ACR-0034 Konga Line shared foundation', () => {
  it('keeps legacy-safe placement attribution explicit and versions live events', () => {
    const event: McsKongaPlacementEvent = {
      ...placement,
      contractVersion: MCS_KONGA_CONTRACT_VERSION,
      eventId: 'placement_event_204',
    };

    expect(event.contractVersion).toBe('konga-v1');
    expect(event.addedBy).toBeNull();
  });

  it('keeps attempt replay distinct from a newly created position', () => {
    const created: McsKongaPlaceProspectResult = {
      contractVersion: 'konga-v1',
      prospectId: 'prospect_contract_test',
      placementId: 'placement_attempt_2',
      placementAttemptId: 'invite_record_2',
      positionNumber: 205,
      placedAt,
      alreadyPlaced: false,
    };
    const replayed: McsKongaPlaceProspectResult = {
      ...created,
      alreadyPlaced: true,
    };

    expect(created.alreadyPlaced).toBe(false);
    expect(replayed.placementId).toBe(created.placementId);
    expect(replayed.positionNumber).toBe(created.positionNumber);
  });

  it('pins snapshot telemetry, visit correlation, and all SSE discriminators', () => {
    const snapshot: McsKongaHoldingTankSnapshot = {
      contractVersion: 'konga-v1',
      globalMaxPosition: 205,
      recent: [placement],
      placementsThisWeek: 12,
      geoSpreadCount: 7,
      nextWebinar: null,
      sinceLastVisit: null,
      pageVisitId: '00000000-0000-4000-8000-000000000001',
    };
    const joined: McsJoinEvent = {
      contractVersion: 'konga-v1',
      eventId: 'join_event_204',
      positionNumber: 204,
      firstName: 'Test',
      lastInitial: 'P.',
      city: 'Pasadena',
      stateOrRegion: 'CA',
      addedBy: { firstName: 'Sponsor', lastInitial: 'S.' },
      joinedAt: placedAt,
    };
    const events: McsKongaStreamEvent[] = [
      { event: 'snapshot', id: null, data: snapshot },
      {
        event: 'placement',
        id: 'placement_event_204',
        data: {
          ...placement,
          contractVersion: 'konga-v1',
          eventId: 'placement_event_204',
        },
      },
      { event: 'join', id: joined.eventId, data: joined },
      { event: 'ping', id: null, data: { at: placedAt } },
    ];

    expect(events.map((event) => event.event)).toEqual([
      'snapshot',
      'placement',
      'join',
      'ping',
    ]);
    expect(snapshot.sinceLastVisit).toBeNull();
  });

  it('makes replay completion replay-scoped and binds replay to resource authority', () => {
    const replay: McsWebinarReplay = {
      contractVersion: 'konga-v1',
      eventId: 'webinar_event_1',
      resourceVersionId: 'webinar:opportunity:2026-07-10:v1',
      recordedAt: '2026-07-10T17:00:00.000Z',
      availableAt: '2026-07-17T00:00:00.000Z',
      displayDate: 'July 10, 2026',
      publicationStatus: 'active',
    };
    const event: McsKongaVideoEventPayload = {
      kind: 'replay_complete',
      replayEventId: replay.eventId,
      resourceVersionId: replay.resourceVersionId,
    };

    expect(event.kind).toBe('replay_complete');
    expect(replay.resourceVersionId).toMatch(/:v1$/);
  });

  it('pins report-only mission-funnel discriminators to canonical facts', () => {
    const events: McsMissionFunnelEvent[] = [
      {
        contractVersion: 'konga-v1',
        eventId: 'mission_signup_1',
        baTmagId: 'TMBA-CONTRACT',
        occurredAt: placedAt,
        reportOnly: true,
        kind: 'signup',
        signupAt: placedAt,
        sourceAuthority: 'team_magnificent_members.createdAt',
      },
      {
        contractVersion: 'konga-v1',
        eventId: 'mission_first_invite_1',
        baTmagId: 'TMBA-CONTRACT',
        occurredAt: placedAt,
        reportOnly: true,
        kind: 'first_invite',
        firstInviteAt: placedAt,
        sourceAuthority: 'invitation_activity.invitation_sent',
      },
      {
        contractVersion: 'konga-v1',
        eventId: 'mission_two_in_72_1',
        baTmagId: 'TMBA-CONTRACT',
        occurredAt: placedAt,
        reportOnly: true,
        kind: 'two_in_72_achieved',
        signupAt: placedAt,
        achievedAt: placedAt,
        attestedEnrollmentCount: 2,
        sourceAuthority: 'attested_enrollment_relationships',
      },
      {
        contractVersion: 'konga-v1',
        eventId: 'mission_depth_1',
        baTmagId: 'TMBA-CONTRACT',
        occurredAt: placedAt,
        reportOnly: true,
        kind: 'duplication_depth',
        computedAt: placedAt,
        depth: 1,
        sourceAuthority: 'attested_enrollment_relationships',
      },
    ];

    expect(events.every((event) => event.reportOnly)).toBe(true);
    expect(events.map((event) => event.kind)).toEqual([
      'signup',
      'first_invite',
      'two_in_72_achieved',
      'duplication_depth',
    ]);
  });

  it('exports the canonical D-23 token roles without decorative drift', () => {
    expect(MCS_KONGA_D23_TOKENS.colors).toMatchObject({
      ground: '#05070F',
      slateHeritage: '#0F172A',
      structureMotion: '#3B82F6',
      valueMoment: '#FACC15',
      livePulse: '#06B6D4',
      ink: '#E4EAF6',
      muted: '#8CA0C4',
    });
    expect(MCS_KONGA_D23_TOKENS.typography).toMatchObject({
      display: { family: 'Orbitron' },
      body: { family: 'Poppins' },
      telemetry: {
        family: 'Spline Sans Mono',
        numericVariant: 'tabular-nums',
      },
    });
    expect(MCS_KONGA_D23_TOKENS.gradient.allowedOn).toEqual([
      'wordmark',
      'thesis_accent',
    ]);
    expect(MCS_KONGA_D23_TOKENS.gradient.decorativeUseAllowed).toBe(false);
    expect(MCS_KONGA_D23_TOKENS.orientation).toMatchObject({
      axis: 'vertical',
      direction: 'upward',
      destination: 'top',
      arrivals: 'bottom',
      ownNode: 'pinned',
    });
    expect(MCS_KONGA_D23_CSS_VARIABLES['--konga-blue']).toBe('#3B82F6');
  });
});
