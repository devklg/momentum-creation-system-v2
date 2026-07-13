import type {
  McsAdminLaunchReadinessResponse,
  McsLaunchReadinessItem,
  McsLaunchReadinessStatus,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';

const DB = 'momentum';
type Row = Record<string, unknown>;
type Persistence = typeof persistenceCall;

const SOURCES = {
  members: 'team_magnificent_members',
  orientation: 'tmag_new_member_orientation_reservations',
  training: 'tmag_fast_start_progress',
  invitations: 'tmag_prospects',
  profiles: 'tmag_steve_success_interview',
  crm: 'tmag_prospect_crm_records',
} as const;

async function readRows(persistence: Persistence, collection: string, limit: number): Promise<Row[]> {
  const result = await persistence<{ documents?: Row[] }>('mongodb', 'query', {
    database: DB,
    collection,
    filter: {},
    limit,
  });
  return result.documents ?? [];
}

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function group(rows: Row[], key: string): Map<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const row of rows) {
    const id = text(row, key);
    if (!id) continue;
    const values = result.get(id) ?? [];
    values.push(row);
    result.set(id, values);
  }
  return result;
}

function item(
  domain: McsLaunchReadinessItem['domain'],
  status: McsLaunchReadinessStatus,
  source: string,
  evidenceCount: number,
  href: string,
  detail: string,
): McsLaunchReadinessItem {
  return { domain, status, source, evidenceCount, href, detail };
}

export async function buildAdminLaunchReadiness(
  options: { limit?: number; persistence?: Persistence } = {},
): Promise<McsAdminLaunchReadinessResponse> {
  const persistence = options.persistence ?? persistenceCall;
  const limit = Math.min(50_000, Math.max(1, Math.floor(options.limit ?? 10_000)));
  const members = await readRows(persistence, SOURCES.members, Math.min(limit, 2_000));
  const warnings: string[] = [];

  async function safeSource(name: keyof Omit<typeof SOURCES, 'members'>): Promise<Row[] | null> {
    try {
      return await readRows(persistence, SOURCES[name], limit);
    } catch {
      warnings.push(`${SOURCES[name]} unavailable; ${name} state is shown as source_unavailable.`);
      return null;
    }
  }

  const [orientation, training, invitations, profiles, crm] = await Promise.all([
    safeSource('orientation'), safeSource('training'), safeSource('invitations'),
    safeSource('profiles'), safeSource('crm'),
  ]);
  const orientationByBa = orientation ? group(orientation.filter((r) => r.status === 'reserved'), 'tmagId') : null;
  const trainingByBa = training ? group(training, 'tmagId') : null;
  const invitationsByBa = invitations ? group(invitations, 'sponsorTmagId') : null;
  const profilesByBa = profiles ? group(profiles, 'tmagId') : null;
  const crmByBa = crm ? group(crm, 'sponsorTmagId') : null;

  const rows = members.map((member) => {
    const tmagId = text(member, 'tmagId') ?? '';
    const firstName = text(member, 'firstName') ?? '';
    const lastName = text(member, 'lastName') ?? '';
    const myOrientation = orientationByBa?.get(tmagId) ?? [];
    const myTraining = trainingByBa?.get(tmagId) ?? [];
    const myInvites = invitationsByBa?.get(tmagId) ?? [];
    const myProfiles = profilesByBa?.get(tmagId) ?? [];
    const myCrm = crmByBa?.get(tmagId) ?? [];

    const completedModules = myTraining.filter((row) => row.state === 'completed').length;
    const trainingStarted = myTraining.some((row) => row.state === 'completed' || row.state === 'in_progress');
    const sentInvites = myInvites.filter((row) => text(row, 'sentAt') !== null).length;
    const inviteIds = new Set(myInvites.flatMap((row) => {
      const id = text(row, 'prospectId'); return id ? [id] : [];
    }));

    const profile = myProfiles[0];
    const successProfile = profile?.successProfile as Row | undefined;
    const profileValid = myProfiles.length === 1
      && text(profile!, 'completedAt') !== null
      && text(successProfile ?? {}, 'tmagId') === tmagId;
    const profileAttention = myProfiles.length > 1 || (myProfiles.length === 1 && !profileValid);

    const crmByProspect = group(myCrm, 'prospectId');
    let crmAttention = myCrm.some((record) => {
      const prospectId = text(record, 'prospectId');
      return !prospectId || !inviteIds.has(prospectId)
        || text(record, 'ownerTmagId') !== tmagId
        || text(record, 'sponsorTmagId') !== tmagId;
    });
    if (myInvites.some((invite) => (crmByProspect.get(text(invite, 'prospectId') ?? '')?.length ?? 0) !== 1)) {
      crmAttention = true;
    }
    if ([...crmByProspect.values()].some((records) => records.length > 1)) crmAttention = true;
    const readyCrm = [...crmByProspect.entries()].filter(([prospectId, records]) =>
      inviteIds.has(prospectId) && records.length === 1
      && text(records[0]!, 'ownerTmagId') === tmagId,
    ).length;

    const readinessItems: McsLaunchReadinessItem[] = [
      item('orientation', orientation === null ? 'source_unavailable'
        : myOrientation.length > 0 ? 'scheduled' : 'source_unavailable',
      'tmag_new_member_orientation_reservations; attendance completion is not tracked',
      myOrientation.length, '/orientation', myOrientation.length > 0
        ? 'Orientation seat reserved; elapsed time never implies attendance.'
        : 'No active reservation; attendance completion has no durable source.'),
      item('training', training === null ? 'source_unavailable'
        : completedModules >= 5 ? 'complete' : trainingStarted ? 'in_progress' : 'not_started',
      'tmag_fast_start_progress', completedModules, '/training/fast-start/product',
      training === null ? 'Training source unavailable.' : `${completedModules} Fast Start modules completed.`),
      item('invitations', invitations === null ? 'source_unavailable'
        : sentInvites > 0 ? 'complete' : myInvites.length > 0 ? 'in_progress' : 'not_started',
      'tmag_prospects invitation spine', sentInvites > 0 ? sentInvites : myInvites.length, '/ivory',
      invitations === null ? 'Invitation source unavailable.' : `${myInvites.length} invitations; ${sentInvites} confirmed sent.`),
      item('success_profile', profiles === null ? 'source_unavailable'
        : profileAttention ? 'needs_attention' : profileValid ? 'complete' : 'not_started',
      'tmag_steve_success_interview persisted artifact', myProfiles.length, '/steve/discovery',
      profileAttention ? 'Profile evidence is duplicated or identity-inconsistent; review only.'
        : profileValid ? 'Non-scored Success Profile is available.' : 'No completed Success Profile artifact.'),
      item('crm', invitations === null || crm === null ? 'source_unavailable'
        : crmAttention ? 'needs_attention' : readyCrm > 0 ? 'ready' : 'not_started',
      'tmag_prospect_crm_records matched to owned invitation prospects', readyCrm, '/cockpit#pmv',
      crmAttention ? 'CRM evidence is missing, duplicated, orphaned, or identity-inconsistent; report-only.'
        : readyCrm > 0 ? `${readyCrm} CRM records match owned invitations.` : 'CRM begins with the first invitation.'),
    ];
    return {
      tmagId,
      fullName: `${firstName} ${lastName}`.trim(),
      sponsorTmagId: text(member, 'sponsorTmagId'),
      readiness: {
        items: readinessItems,
        attentionDomains: readinessItems.filter((entry) => entry.status === 'needs_attention').map((entry) => entry.domain),
      },
    };
  }).sort((a, b) => a.fullName.localeCompare(b.fullName) || a.tmagId.localeCompare(b.tmagId));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    policy: 'read_only_report_only',
    rows,
    summary: { members: rows.length, membersWithAttention: rows.filter((row) => row.readiness.attentionDomains.length > 0).length },
    warnings,
  };
}
