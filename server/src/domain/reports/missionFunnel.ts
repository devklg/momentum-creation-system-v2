import { createHash } from 'node:crypto';
import type {
  McsMissionFunnelEvent,
  McsMissionFunnelReportResponse,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../../services/persistence/dispatch.js';

const H72_MS = 72 * 60 * 60 * 1000;

interface BaFact {
  tmagId: string;
  createdAt: string;
  deleted?: boolean;
}

interface InviteFact {
  sponsorTmagId: string;
  kind: string;
  at: string;
}

interface EnrollmentFact {
  sponsorTmagId: string;
  enrolleeTmagId: string;
  joinedAt: string;
  humanAttested: boolean;
  status: string;
}

interface DepthFact {
  baTmagId: string;
  depth: number | { low: number };
}

function hashId(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function depthNumber(value: DepthFact['depth'] | undefined): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') return value.low;
  return 0;
}

export function projectMissionFunnelFacts(input: {
  bas: BaFact[];
  invites: InviteFact[];
  enrollments: EnrollmentFact[];
  depths: DepthFact[];
  generatedAt: string;
}): McsMissionFunnelEvent[] {
  const events: McsMissionFunnelEvent[] = [];
  const depthByBa = new Map(input.depths.map((fact) => [fact.baTmagId, depthNumber(fact.depth)]));

  for (const ba of input.bas) {
    const signupAt = ba.createdAt;
    events.push({
      contractVersion: MCS_KONGA_CONTRACT_VERSION,
      eventId: `mission_signup_${hashId(`${ba.tmagId}|${signupAt}`)}`,
      baTmagId: ba.tmagId,
      occurredAt: signupAt,
      reportOnly: true,
      kind: 'signup',
      signupAt,
      sourceAuthority: 'team_magnificent_members.createdAt',
    });

    const firstInviteAt = input.invites
      .filter((fact) => fact.sponsorTmagId === ba.tmagId && fact.kind === 'invitation_sent')
      .map((fact) => fact.at)
      .sort()[0];
    if (firstInviteAt) {
      events.push({
        contractVersion: MCS_KONGA_CONTRACT_VERSION,
        eventId: `mission_first_invite_${hashId(`${ba.tmagId}|${firstInviteAt}`)}`,
        baTmagId: ba.tmagId,
        occurredAt: firstInviteAt,
        reportOnly: true,
        kind: 'first_invite',
        firstInviteAt,
        sourceAuthority: 'invitation_activity.invitation_sent',
      });
    }

    const deadline = Date.parse(signupAt) + H72_MS;
    const qualifying = input.enrollments
      .filter(
        (fact) =>
          fact.sponsorTmagId === ba.tmagId &&
          fact.humanAttested === true &&
          fact.status === 'completed' &&
          Date.parse(fact.joinedAt) >= Date.parse(signupAt) &&
          Date.parse(fact.joinedAt) <= deadline,
      )
      .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
    const distinct = new Map<string, EnrollmentFact>();
    for (const fact of qualifying) {
      if (!distinct.has(fact.enrolleeTmagId)) distinct.set(fact.enrolleeTmagId, fact);
    }
    const firstTwo = [...distinct.values()].slice(0, 2);
    const achievedAt = firstTwo[1]?.joinedAt;
    if (achievedAt) {
      events.push({
        contractVersion: MCS_KONGA_CONTRACT_VERSION,
        eventId: `mission_two_in_72_${hashId(`${ba.tmagId}|${achievedAt}`)}`,
        baTmagId: ba.tmagId,
        occurredAt: achievedAt,
        reportOnly: true,
        kind: 'two_in_72_achieved',
        signupAt,
        achievedAt,
        attestedEnrollmentCount: 2,
        sourceAuthority: 'attested_enrollment_relationships',
      });
    }

    events.push({
      contractVersion: MCS_KONGA_CONTRACT_VERSION,
      eventId: `mission_depth_${hashId(`${ba.tmagId}|${input.generatedAt}`)}`,
      baTmagId: ba.tmagId,
      occurredAt: input.generatedAt,
      reportOnly: true,
      kind: 'duplication_depth',
      computedAt: input.generatedAt,
      depth: Math.max(0, depthByBa.get(ba.tmagId) ?? 0),
      sourceAuthority: 'attested_enrollment_relationships',
    });
  }

  return events.sort((a, b) =>
    a.occurredAt === b.occurredAt
      ? a.eventId.localeCompare(b.eventId)
      : a.occurredAt.localeCompare(b.occurredAt),
  );
}

export async function buildMissionFunnelReport(
  now: Date = new Date(),
  persistence: typeof persistenceCall = persistenceCall,
): Promise<McsMissionFunnelReportResponse> {
  const [basResult, inviteResult, enrollmentResult, depthResult] = await Promise.all([
    persistence<{ documents?: BaFact[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'team_magnificent_members',
      filter: { deleted: { $ne: true } },
      sort: { createdAt: 1 },
      limit: 50_000,
    }),
    persistence<{ documents?: InviteFact[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'tmag_prospect_invitation_activity',
      filter: { kind: 'invitation_sent' },
      sort: { at: 1 },
      limit: 200_000,
    }),
    persistence<{ documents?: EnrollmentFact[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'tmag_konga_enrollment_attestations',
      filter: { humanAttested: true, status: 'completed' },
      sort: { joinedAt: 1 },
      limit: 200_000,
    }),
    persistence<{ records?: DepthFact[] }>('neo4j', 'cypher', {
      query:
        'MATCH (b:TeamMagnificentMember) ' +
        'OPTIONAL MATCH p=(b)-[:ENROLLED*1..50]->(:TeamMagnificentMember) ' +
        'WHERE all(r IN relationships(p) WHERE r.humanAttested=true) ' +
        'RETURN b.tmagId AS baTmagId, coalesce(max(length(p)),0) AS depth',
      params: {},
    }),
  ]);
  const generatedAt = now.toISOString();
  return {
    ok: true,
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    generatedAt,
    reportOnly: true,
    events: projectMissionFunnelFacts({
      bas: basResult.documents ?? [],
      invites: inviteResult.documents ?? [],
      enrollments: enrollmentResult.documents ?? [],
      depths: depthResult.records ?? [],
      generatedAt,
    }),
  };
}
