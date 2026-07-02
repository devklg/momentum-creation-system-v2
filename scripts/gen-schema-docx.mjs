// Generates the canonical MCS V2 schema list as a print-ready .docx for Kevin's
// review + approval before store provisioning. REV 2 — incorporates Kevin's
// 2026-07-01 review: tmag_ collection scheme + semantic grouping, per-agent
// event split, tmag_agent_templates + tmag_content_templates, PascalCase Neo4j
// Tmag* labels, collapsed double-prefixes, purposes that answer his questions.
import {
  Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType,
} from 'docx';
import { writeFileSync } from 'node:fs';

const GOLD = 'FACC15', INK = '14161C', BLUE = '3B82F6', PURPLE = '8A2BE2', LINE = 'E4E7EE', SOFT = 'F6F7FB';
const FONT = 'Calibri', MONO = 'Consolas';

const t = (text, o = {}) => new TextRun({ text, font: o.mono ? MONO : FONT, bold: o.b, italics: o.i, color: o.color, size: o.size || 20 });
const p = (runs, o = {}) => new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: o.after ?? 80 }, alignment: o.align });
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 100 }, children: [new TextRun({ text, font: FONT, bold: true, size: 30, color: INK })] });
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 180, after: 80 }, children: [new TextRun({ text, font: FONT, bold: true, size: 24, color: BLUE })] });

function cell(runs, { w, head, shade } = {}) {
  return new TableCell({
    width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined,
    shading: head ? { type: ShadingType.SOLID, color: INK } : shade ? { type: ShadingType.SOLID, color: SOFT } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ spacing: { after: 0 }, children: Array.isArray(runs) ? runs : [runs] })],
  });
}
function table(headers, rows, widths) {
  const border = { style: BorderStyle.SINGLE, size: 2, color: LINE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((hh, i) => cell(new TextRun({ text: hh, font: FONT, bold: true, color: 'FFFFFF', size: 18 }), { w: widths?.[i], head: true })) }),
      ...rows.map((r, ri) => new TableRow({ children: r.map((c, i) => cell(Array.isArray(c) ? c : new TextRun({ text: String(c), font: i === 0 ? MONO : FONT, size: 17 }), { w: widths?.[i], shade: ri % 2 === 1 })) })),
    ],
  });
}

// ── canonical collection data (REV 2, post-review) ────────────────────────────
// Convention: tmag_ = Team Magnificent app-domain data · mcs_ = system/memory layer.
const mongoA = [
  ['team_magnificent_members', 'tmagId', 'tmagId · threeBaId · threeUsername · firstName · lastName · email · phone · timezone · createdAt; passwordHash · sponsorTmagId · accessCodeUsed · accessCodeHeld; onboarding flags', 'Master MEMBER identity + login (TMAG-…). Not "brand ambassador" — that is the III credential (threeBaId).'],
  ['tmag_access_codes', 'code', 'code (TMAG-XXXX) · sponsorTmagId · sponsorFirstName · sponsorLastName · createdAt · active', 'TMAG-XXXX sponsor codes; the membership-eligibility gate. One active/member for life; only Kevin mints.'],
  ['tmag_commitments', 'commitmentId', 'commitmentId · tmagId · threeBaId · email · version · acceptedAt', 'One-click member commitment acceptance (audit-grade).'],
  ['tmag_questionnaires', 'questionnaireId', 'questionnaireId · tmagId · version · submittedAt + 21 enum answers', 'Self-serve member interview.'],
  ['tmag_workbooks', 'workbookId', 'workbookId · forTmagId · conductedByTmagId · status(draft|final) · version', 'Sponsor-led 20-Q member interview; draft→final.'],
  ['tmag_profile_change_challenges', 'challengeId', 'challengeId · tmagId · channel(email|phone) · target · codeHash · issuedAt · expiresAt', '15-min single-use email/phone verification.'],
];
const mongoB = [
  ['tmag_prospects', 'prospectId', 'prospectId · firstName · lastName · location · sponsorTmagId · state · becameCustomer · token · source', 'The invited person (funnel). sponsorTmagId immutable.'],
  ['tmag_prospect_invite_tokens', 'token', 'token · prospectId · sponsorTmagId · state · createdAt · expiresAt', 'Opaque 12-char token; forward-only lifecycle rail.'],
  ['tmag_prospect_invitation_activity', 'activityId', 'activityId · prospectId · sponsorTmagId · kind · note · at', 'Append-only member-side timeline.'],
  ['tmag_prospect_htank_counters', "'tm_team_pool'", 'current · createdAt', 'Holding-tank: single-row monotonic team counter.'],
  ['tmag_prospect_htank_placements', 'prospectId', 'prospectId · sponsorTmagId · positionNumber · placedAt · expiresAt · flushedAt', 'Holding-tank: one placement/prospect; monotonic, never renumbered.'],
  ['tmag_prospect_htank_accounts', 'accountId', 'accountId · prospectId · tokenId · sponsorTmagId · reentryCode', 'Holding-tank: durable prospect re-entry account.'],
  ['tmag_prospect_magic_links', 'linkToken', 'linkToken · accountId · tokenId · issuedAt · expiresAt · smsDeliveryStatus', 'Single-use 60-min SMS re-entry link.'],
  ['tmag_prospect_sessions', 'sessionId', 'sessionId · accountId · prospectId · tokenId · sponsorTmagId', 'Opaque .com session. Mongo-only.'],
  ['tmag_prospect_callback_requests', 'callbackRequestId', 'callbackRequestId · token · prospectId · sponsorTmagId · intent · smsDeliveryStatus', 'Prospect "raise hand": clicks "have my sponsor contact me" on the .com video/dashboard → surfaces in the sponsor cockpit. The immediate "call me" signal (≠ booking a webinar).'],
  ['tmag_prospect_crm_notes', 'noteId', 'noteId · prospectId · sponsorTmagId · text · createdAt', 'Member-private append-only prospect notes.'],
  ['tmag_prospect_crm_followups', 'followUpId', 'followUpId · prospectId · sponsorTmagId · dueAt · clearedAt', 'One active reminder per (prospect, member).'],
  ['tmag_prospect_crm_dispositions', 'crmdispo_<p>_<m>', 'prospectId · sponsorTmagId · disposition · updatedAt', 'Current disposition (one canonical CrmDisposition enum).'],
  ['tmag_prospect_crm_records', 'crm_<prospectId>', 'crmRecordId · prospectId · ownerTmagId · sponsorTmagId · source · status · disposition · closedReason · followUpDueAt', 'VM/RVM lead-campaign CRM layer.'],
  ['tmag_prospect_timeline_events', 'eventId', 'eventId · prospectId · ownerTmagId · sponsorTmagId · kind · title · occurredAt', 'Append-only VM-aware CRM timeline (~26 kinds).'],
];
const mongoC = [
  ['tmag_prospect_webinar_events', 'eventId', 'eventId · scheduledFor · hosts[] · durationMinutes · status', 'Scheduled prospect webinars.'],
  ['tmag_prospect_webinar_reservations', 'reservationId', 'reservationId · eventId · token · prospectId · sponsorTmagId · attendance(yes|no|missed|rescheduled) · scheduledFor · rescheduledTo', 'Prospect seat reservations + attendance.'],
  ['tmag_new_member_orientation_sessions', 'sessionId', 'sessionId · scheduledFor · hosts[] · capacity · durationMinutes · status', 'New-member group orientation (cap 10).'],
  ['tmag_new_member_orientation_reservations', 'reservationId', 'reservationId · sessionId · tmagId · scheduledFor · status', 'Member seat reservations.'],
  ['tmag_fast_start_progress', '<tmagId>__module-<n>', 'tmagId · moduleId · state', 'Per-member-per-module training state.'],
  ['tmag_steve_success_interview', 'SD-<tmagId>', 'tmagId · successProfile', 'Steve Discovery & Success Interview (1/member).'],
];
const mongoD = [
  ['tmag_agent_ivory_events', 'eventId', 'eventId · tmagId · agentId · kind · createdAt', 'Ivory agent-interaction audit trail (split per agent).'],
  ['tmag_agent_michael_events', 'eventId', 'eventId · tmagId · agentId · kind · createdAt', 'Michael agent-interaction audit trail.'],
  ['tmag_agent_steve_events', 'eventId', 'eventId · tmagId · agentId · kind · createdAt', 'Steve agent-interaction audit trail.'],
  ['tmag_agent_templates', 'templateId', 'templateId · agentKey(ivory|michael|steve|…) · templateKind(learning|interviewing|invitation|…) · version · steps · questionSet · guardrails · knowledgeDomains[]', 'NEW. The agent operating "roads": the templates each agent runs on and the knowledge domains it pulls from. First-class agent operating system.'],
  ['tmag_content_templates', 'templateVersionId', 'templateVersionId · tenantId · templateKey · surface · version', 'Renamed from master_content_versions. Versioned served copy/content rendered to users.'],
  ['tmag_invitation_generator_runs', 'runId', 'runId · tmagId · productKey · productName · angle', 'WDYK invitation-generator sessions.'],
  ['tmag_ivory_prospect_names', 'ivoryId', 'ivoryId · tmagId · firstName · lastName · categories[] · status', 'Member-private warm-market roster (Ivory).'],
  ['mcs_audit_log', 'entryId', 'entryId · timestamp · role · actor · action · entity · severity + runtime block (R0)', 'SYSTEM. Canonical append-only audit substrate.'],
  ['tmag_projection_outbox', 'outboxId', 'outboxId · tier · target · entityId · payload · status · attempts · nextAttemptAt', 'Durable retry queue for PROJECTIONS = the triple-stack mirror writes (Mongo→Neo4j/Chroma). Keeps the three stores in sync when one hiccups (H1).'],
  ['tenant_settings_versions', 'settingsVersionId', 'settingsVersionId · version · reason · tenantId · complianceMode', 'SYSTEM. Append-only tenant settings history.'],
  ['tmag_admin_settings', 'human key', 'value', 'Single-row-per-key admin config.'],
  ['tmag_admin_sponsor_overrides', 'overrideId', 'overrideId · tmagId · previousSponsorTmagId · newSponsorTmagId · requestingTmagId · reason · performedByTmagId · auditEntryId', 'Append-only sponsor-override history.'],
  ['tmag_admin_curated_leader_tags', 'curated_<tmagId>', 'tmagId · curated · setByTmagId · setAt', 'Curated-leader badge.'],
  ['tmag_admin_member_notes', 'noteId', 'noteId · tmagId · text · authorTmagId · createdAt', 'Kevin-private member notes.'],
  ['tmag_admin_prospect_notes', 'noteId', 'noteId · prospectId · body · createdByTmagId', 'Kevin-private prospect notes.'],
];
const mongoE = [
  ['tmag_vm_lead_batches', 'leadBatchId', 'leadBatchId · ownerTmagId · sponsorTmagId · name · source · country · leadType · status', 'Member-owned acquisition batch. (You noted "lead_owners" — confirm if you want the rename.)'],
  ['tmag_vm_campaigns', 'vmCampaignId', 'vmCampaignId · ownerTmagId · leadBatchId · name · provider · status · adminApprovedForLiveDelivery', 'Member-owned VM campaign.'],
  ['tmag_vm_bulk_leads', 'leadId', 'leadId · leadBatchId · ownerTmagId · vmCampaignId · status · dedupeKey', 'Imported VM/RVM leads.'],
  ['tmag_vm_queue_jobs', 'jobId', 'jobId · kind · status · attempts · availableAt', 'Durable VM work queue.'],
  ['tmag_vm_delivery_events', 'eventId', 'eventId · provider · leadId · vmCampaignId · ownerTmagId · channel · status · dryRun · attempt', 'VM send/webhook history.'],
  ['tmag_vm_provider_webhook_events', 'webhookEventId', 'webhookEventId · provider · payload · status', 'Raw webhook ingestion.'],
  ['tmag_vm_audit_events', 'auditId', 'auditId · action · entityId · summary', 'Append-only VM operational audit.'],
  ['tmag_vm_suppression_list', '(undetermined)', 'ownerTmagId + (normalizedPhone|normalizedEmail)', 'Do-not-contact list (defer until writer confirmed).'],
  ['tmag_broadcasts', 'broadcastId', 'broadcastId · createdByTmagId · isTestSend · audiencePreset · channel · template · recipientCount · status', 'Kevin-only broadcast master.'],
  ['tmag_broadcast_recipients', '<bc>::<tmagId>', 'rowId · broadcastId · recipientTmagId · channel · status · attempts · queuedAt', 'One row/recipient.'],
  ['tmag_broadcast_optouts', 'tmagId', 'tmagId · reason · addedAt', 'Global permanent STOP list.'],
];
const mongoF = [
  ['mcs_outcomes', 'id', 'envelope + kind(pending|enrolled_iii|became_customer|declined) · confirmedByTmagId · outcomeAt', 'MEMORY (R1). Member-confirmed prospect resolution — the raw signal the system learns from.'],
  ['mcs_learning_candidates', 'id', 'envelope + status · domain · language · proposedSummary · sourceOutcomeIds[] · review?', 'MEMORY (R2). A PROPOSED insight derived from outcomes ("this seems to work"), awaiting KEVIN\'s approval. No agent may approve.'],
  ['mcs_graphrag_records', 'id', 'envelope + knowledgeObjectId · version · domain · language · summary · model · retrievalReady', 'MEMORY (R3). Approved ACTIVE knowledge the agent templates pull from at runtime.'],
];

// Phase 7 memory = the learning layer: outcomes (signal) → learning candidates
// (proposed, you approve) → graphrag (active knowledge the templates pull from).

const neo4j = [
  ['TeamMagnificentMember', 'tmagId', 'SPONSORED_BY→(:TeamMagnificentMember); MEMBER_OF→(:TeamMagnificent); HOLDS_CODE→(:TmagAccessCode)', 'The canonical MEMBER node (downline tree).'],
  ['TeamMagnificent', 'teamKey', '(target of MEMBER_OF / SCOPED_TO)', 'The single team scope node.'],
  ['TmagProspect', 'prospectId', 'SPONSORED_BY→(:TeamMagnificentMember); HAS_TOKEN→(:TmagInviteToken); IN_HOLDING_TANK→(:TmagPool)', 'Funnel entity (non-member).'],
  ['TmagOutcome', 'id', 'CONFIRMED_BY→(:TeamMagnificentMember); ABOUT_PROSPECT→(:TmagProspect); SUPERSEDES; SCOPED_TO→(:TeamMagnificent)', 'R1 outcome lineage (graph side of mcs_outcomes).'],
  ['TmagLearningCandidate', 'id', 'DERIVED_FROM→(:TmagOutcome); SCOPED_TO→(:TeamMagnificent)', 'R2 provenance: a proposed insight and the outcomes it came from.'],
  ['TmagKnowledge', 'id', 'SCOPED_TO→(:TeamMagnificent); SUPERSEDES', 'R3 active-knowledge nodes (graph side of mcs_graphrag).'],
  ['TmagAuditEntry', 'entryId', 'ACTED_FOR→(:TeamMagnificentMember)', 'Graph side of mcs_audit_log: links each audited action to who did it.'],
  ['Tmag<BusinessLabel>', 'business key', 'TmagInviteToken.token · TmagAccessCode.code · TmagWebinarEvent.eventId · TmagIvoryName.ivoryId · TmagBroadcast.broadcastId · TmagVmCampaign.vmCampaignId · …', 'Per-label uniqueness constraints. This SET GROWS as features are added — same constraint pattern each time (P10 §6).'],
];

const chroma = [
  ['Identity / onboarding', 'team_magnificent_members · tmag_access_codes · tmag_commitments · tmag_questionnaires · tmag_workbooks · tmag_steve_success_interview · tmag_fast_start_progress'],
  ['Prospect / funnel', 'tmag_prospect_invitation_activity · tmag_prospect_callback_requests · tmag_prospect_htank_events · tmag_prospect_magic_links · tmag_prospect_webinar_reservations · tmag_prospect_crm_records · tmag_prospect_timeline_events'],
  ['Agents / templates / admin', 'tmag_agent_ivory_events · tmag_agent_michael_events · tmag_agent_steve_events · tmag_agent_templates · tmag_ivory_prospect_names · mcs_audit_log · tmag_content_templates · tmag_broadcasts'],
  ['VM', 'tmag_vm_lead_batches · tmag_vm_bulk_leads · tmag_vm_campaigns · tmag_vm_delivery_events'],
  ['Memory / learning (system)', 'mcs_outcomes · mcs_learning_candidates_review (review-only) · 10× mcs_<domain>_knowledge_<lang> (active)'],
];

const enums = [
  ['Prospect / token state', 'minted · clicked · video_started · video_quarter · video_half · video_three_quarter · video_complete · enrolled · expired'],
  ['Outcome / prospect status', 'pending · enrolled_iii · became_customer · declined'],
  ['Webinar attendance', 'yes · no · missed · rescheduled (+ scheduledFor / rescheduledTo)'],
  ['CRM disposition (one enum)', 'new_brand_ambassador · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact'],
  ['Agent template kind', 'learning · interviewing · invitation · (+ future)'],
  ['Learning domain', 'success · training · relationship · performance · organizational'],
  ['Language', 'en · es'],
  ['Runtime audit action', 'runtime.turn.{opened,draft_emitted,closed} · runtime.gate.{allowed,denied} · runtime.persistence.{enabled,disabled}'],
  ['Persistence mode', 'gateway · direct'],
];

const W = ['24', '13', '40', '23'];
const collTable = (rows) => table(['Collection', 'Key (_id)', 'Core fields', 'Purpose'], rows, W);

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'MOMENTUM CREATION SYSTEM V2', font: FONT, bold: true, size: 22, color: PURPLE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Canonical Schema List — for Provisioning Approval (Rev 2)', font: FONT, bold: true, size: 40, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: 'Team Magnificent · dedicated triple-stack (Mongo momentum@30000 · Neo4j@7710 · Chroma@8200) · post-reidentification canonical names', font: FONT, italics: true, size: 18, color: '5B616E' })] }),
  p([t('Rev 2 folds in Kevin\'s 2026-07-01 review: ', { b: true }), t('tmag_', { mono: true }), t(' prefix on all app-domain collections with semantic grouping (prospect / htank / new_member / agent), the per-agent event split, the new '), t('tmag_agent_templates', { mono: true }), t(' + renamed '), t('tmag_content_templates', { mono: true }), t(', PascalCase Neo4j '), t('Tmag*', { mono: true }), t(' labels, collapsed double-prefixes, and purpose lines that answer the inline questions. '), t('mcs_', { mono: true }), t(' is kept for the system/memory layer.')]),
  p([t('To still confirm (small): ', { b: true }), t('(a) Chroma collections aligned to the tmag_ Mongo names (your "same name across all three stores"); (b) tmag_vm_lead_batches vs your "lead_owners" note; (c) tmag_content_templates + tmag_agent_templates kept separate (my recommendation).', { i: true, size: 18 })]),

  h1('0 · Identity & Membership'),
  p([t('Brand Ambassador = a THREE International role. Being a BA does '), t('not', { b: true }), t(' make someone a Team Magnificent member. A '), t('member', { b: true }), t(' is a BA in Kevin\'s downline. The app\'s canonical entity is the MEMBER (id '), t('tmagId', { mono: true }), t(', value '), t('TMAG-YYYYMMDD-XXXXXX', { mono: true }), t('); the BA credential ('), t('threeBaId', { mono: true }), t(') is an attribute.')]),
  p([t('Eligibility is enforced by ACCESS CODES: to become a member you must be an enrolled III BA AND hold a '), t('TMAG-XXXX', { mono: true }), t(' access code issued by an existing team member (sponsor). Only Kevin mints codes; members reuse their one code to sponsor. Sponsor is immutable.')]),

  h1('1 · MongoDB — collections (database momentum)'),
  h2('A · Identity / Access'), collTable(mongoA),
  h2('B · Prospect / Token / Holding-tank / CRM'), collTable(mongoB),
  h2('C · Webinar / Orientation / Training / Steve'), collTable(mongoC),
  h2('D · Agents / Templates / Governance / Audit / Admin'), collTable(mongoD),
  h2('E · Voicemail (VM/RVM) / Broadcast'), collTable(mongoE),
  h2('F · Memory / Learning (system, mcs_)'), collTable(mongoF),
  p([t('First-pass validator posture (all): required = core above; additionalProperties:true; ISO-string timestamps (never Date); field enums; tighten to additionalProperties:false per-collection after a soak.', { i: true, size: 17 })]),

  h1('2 · Neo4j — labels & constraints (@7710)'),
  table(['Label', 'Key', 'Relationships', 'Purpose'], neo4j, ['22', '13', '43', '22']),

  h1('3 · ChromaDB — collections (384-dim, @8200)'),
  p([t('Names mirror the Mongo collections (one name across all three stores); memory layer stays mcs_.', { i: true, size: 17 })]),
  table(['Group', 'Collections'], chroma, ['24', '76']),

  h1('4 · Enum reference (closed sets)'),
  table(['Enum', 'Values'], enums, ['26', '74']),

  h1('5 · Approval'),
  p([t('Reviewed and approved for provisioning (Mongo $jsonSchema + Neo4j constraints + Chroma registry, moderate mode, reversible):', {})]),
  new Paragraph({ spacing: { before: 240 }, children: [t('Kevin L. Gardner  __________________________________     Date  ______________', { size: 22 })] }),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
});

const out = 'engineering/reports/MCS_V2_CANONICAL_SCHEMAS.docx';
const buf = await Packer.toBuffer(doc);
writeFileSync(out, buf);
console.log('wrote', out, buf.length, 'bytes');
