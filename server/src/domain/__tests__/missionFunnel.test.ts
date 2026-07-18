import { describe, expect, it } from 'vitest';
import { projectMissionFunnelFacts } from '../reports/missionFunnel.js';

describe('report-only Konga mission funnel', () => {
  it('reuses canonical signup/first invite and requires two distinct human attestations within 72 hours', () => {
    const events = projectMissionFunnelFacts({
      bas: [{ tmagId: 'BA-1', createdAt: '2026-07-01T00:00:00.000Z' }],
      invites: [
        { sponsorTmagId: 'BA-1', kind: 'invitation_sent', at: '2026-07-01T03:00:00.000Z' },
        { sponsorTmagId: 'BA-1', kind: 'invitation_sent', at: '2026-07-02T03:00:00.000Z' },
      ],
      enrollments: [
        {
          sponsorTmagId: 'BA-1',
          enrolleeTmagId: 'NEW-1',
          joinedAt: '2026-07-02T00:00:00.000Z',
          humanAttested: true,
          status: 'completed',
        },
        {
          sponsorTmagId: 'BA-1',
          enrolleeTmagId: 'NEW-1',
          joinedAt: '2026-07-02T01:00:00.000Z',
          humanAttested: true,
          status: 'completed',
        },
        {
          sponsorTmagId: 'BA-1',
          enrolleeTmagId: 'NEW-2',
          joinedAt: '2026-07-03T00:00:00.000Z',
          humanAttested: true,
          status: 'completed',
        },
      ],
      depths: [{ baTmagId: 'BA-1', depth: 3 }],
      generatedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(events.find((event) => event.kind === 'signup')).toMatchObject({
      reportOnly: true,
      sourceAuthority: 'team_magnificent_members.createdAt',
    });
    expect(events.find((event) => event.kind === 'first_invite')).toMatchObject({
      firstInviteAt: '2026-07-01T03:00:00.000Z',
      sourceAuthority: 'invitation_activity.invitation_sent',
    });
    expect(events.find((event) => event.kind === 'two_in_72_achieved')).toMatchObject({
      achievedAt: '2026-07-03T00:00:00.000Z',
      attestedEnrollmentCount: 2,
      reportOnly: true,
    });
    expect(events.find((event) => event.kind === 'duplication_depth')).toMatchObject({
      depth: 3,
      reportOnly: true,
    });
  });

  it('does not award two-in-72 for registration-like, duplicate, or late facts', () => {
    const events = projectMissionFunnelFacts({
      bas: [{ tmagId: 'BA-2', createdAt: '2026-07-01T00:00:00.000Z' }],
      invites: [],
      enrollments: [
        {
          sponsorTmagId: 'BA-2',
          enrolleeTmagId: 'NEW-1',
          joinedAt: '2026-07-02T00:00:00.000Z',
          humanAttested: false,
          status: 'completed',
        },
        {
          sponsorTmagId: 'BA-2',
          enrolleeTmagId: 'NEW-2',
          joinedAt: '2026-07-05T00:00:00.000Z',
          humanAttested: true,
          status: 'completed',
        },
      ],
      depths: [],
      generatedAt: '2026-07-17T00:00:00.000Z',
    });
    expect(events.some((event) => event.kind === 'two_in_72_achieved')).toBe(false);
  });
});
