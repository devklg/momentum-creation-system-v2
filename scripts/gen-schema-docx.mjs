// Generates the canonical MCS V2 schema list as a print-ready .docx for Kevin's
// review + approval before store provisioning. Canonical (post-reidentification)
// names: team_magnificent_members / tmagId / TeamMagnificentMember / mcs_* etc.
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

// ── canonical collection data (post-reidentification) ─────────────────────────
const mongoA = [
  ['team_magnificent_members', 'tmagId', 'tmagId · threeBaId · threeUsername · firstName · lastName · email · phone · timezone · createdAt; passwordHash · sponsorTmagId · accessCodeUsed · accessCodeHeld; onboarding flags', 'Master MEMBER identity + login (TMAG-…). Not "brand ambassador" — that is the III credential (threeBaId).'],
  ['access_codes', 'code', 'code (TMAG-XXXX) · sponsorTmagId · sponsorFirstName · sponsorLastName · createdAt · active', 'TMAG-XXXX sponsor codes; the membership-eligibility gate. One active/member for life; only Kevin mints.'],
  ['ba_commitments', 'commitmentId', 'commitmentId · tmagId · threeBaId · email · version · acceptedAt', 'One-click commitment acceptance (audit-grade).'],
  ['ba_questionnaires', 'questionnaireId', 'questionnaireId · tmagId · version · submittedAt + 21 enum answers', 'Self-serve interview.'],
  ['ba_workbooks', 'workbookId', 'workbookId · forTmagId · conductedByTmagId · status(draft|final) · version', 'Sponsor-led 20-Q interview; draft→final.'],
  ['profile_change_challenges', 'challengeId', 'challengeId · tmagId · channel(email|phone) · target · codeHash · issuedAt · expiresAt', '15-min single-use email/phone verification.'],
];
const mongoB = [
  ['prospects', 'prospectId', 'prospectId · firstName · lastName · location · sponsorTmagId · state · becameCustomer · token · source', 'The invited person (funnel). sponsorTmagId immutable.'],
  ['invite_tokens', 'token', 'token · prospectId · sponsorTmagId · state · createdAt · expiresAt', 'Opaque 12-char token; forward-only lifecycle rail.'],
  ['invitation_activity', 'activityId', 'activityId · prospectId · sponsorTmagId · kind · note · at', 'Append-only BA-side timeline.'],
  ['pool_counters', "'tm_team_pool'", 'current · createdAt', 'Single-row monotonic team counter.'],
  ['pool_placements', 'prospectId', 'prospectId · sponsorTmagId · positionNumber · placedAt · expiresAt · flushedAt', 'One placement/prospect; monotonic, never renumbered.'],
  ['prospect_accounts', 'accountId', 'accountId · prospectId · tokenId · sponsorTmagId · reentryCode', 'Durable prospect re-entry account.'],
  ['prospect_magic_links', 'linkToken', 'linkToken · accountId · tokenId · issuedAt · expiresAt · smsDeliveryStatus', 'Single-use 60-min SMS re-entry.'],
  ['prospect_sessions', 'sessionId', 'sessionId · accountId · prospectId · tokenId · sponsorTmagId', 'Opaque .com session. Mongo-only.'],
  ['callback_requests', 'callbackRequestId', 'callbackRequestId · token · prospectId · sponsorTmagId · intent · smsDeliveryStatus', 'Prospect "raised hand".'],
  ['crm_notes', 'noteId', 'noteId · prospectId · sponsorTmagId · text · createdAt', 'BA-private append-only notes.'],
  ['crm_followups', 'followUpId', 'followUpId · prospectId · sponsorTmagId · dueAt · clearedAt', 'One active reminder per (prospect, member).'],
  ['crm_dispositions', 'crmdispo_<p>_<m>', 'prospectId · sponsorTmagId · disposition · updatedAt', 'Current disposition (one canonical CrmDisposition enum).'],
  ['prospect_crm_records', 'crm_<prospectId>', 'crmRecordId · prospectId · ownerTmagId · sponsorTmagId · source · status · disposition · closedReason · followUpDueAt', 'VM/RVM lead-campaign CRM layer.'],
  ['prospect_timeline_events', 'eventId', 'eventId · prospectId · ownerTmagId · sponsorTmagId · kind · title · occurredAt', 'Append-only VM-aware CRM timeline (~26 kinds).'],
];
const mongoC = [
  ['webinar_events', 'eventId', 'eventId · scheduledFor · hosts[] · durationMinutes · status', 'Scheduled prospect webinars.'],
  ['webinar_reservations', 'reservationId', 'reservationId · eventId · token · prospectId · sponsorTmagId · attendance(yes|no|missed|rescheduled) · scheduledFor · rescheduledTo', 'Prospect seat reservations + attendance.'],
  ['orientation_sessions', 'sessionId', 'sessionId · scheduledFor · hosts[] · capacity · durationMinutes · status', 'BA group orientation (cap 10).'],
  ['orientation_reservations', 'reservationId', 'reservationId · sessionId · tmagId · scheduledFor · status', 'Member seat reservations.'],
  ['fast_start_progress', '<tmagId>__module-<n>', 'tmagId · moduleId · state', 'Per-member-per-module training state.'],
  ['steve_discoveries', 'SD-<tmagId>', 'tmagId · successProfile', 'Discovery & Success Interview (1/member).'],
];
const mongoD = [
  ['agent_events', 'eventId', 'eventId · tmagId · agentId · kind · createdAt', 'Agent-interaction audit trail.'],
  ['generator_runs', 'runId', 'runId · tmagId · productKey · productName · angle', 'WDYK Generator sessions.'],
  ['ivory_names', 'ivoryId', 'ivoryId · tmagId · firstName · lastName · categories[] · status', 'BA-private warm-market roster.'],
  ['mcs_audit_log', 'entryId', 'entryId · timestamp · role · actor · action · entity · severity + runtime block (R0)', 'Canonical append-only audit substrate.'],
  ['projection_outbox', 'outboxId', 'outboxId · tier · target · entityId · payload · status · attempts · nextAttemptAt', 'Durable retry queue for projections (H1).'],
  ['tenant_settings_versions', 'settingsVersionId', 'settingsVersionId · version · reason · tenantId · complianceMode', 'Append-only tenant settings history.'],
  ['master_content_versions', 'templateVersionId', 'templateVersionId · tenantId · templateKey · surface · version', 'Append-only master-content overrides.'],
  ['admin_settings', 'human key', 'value', 'Single-row-per-key admin config.'],
  ['admin_sponsor_overrides', 'overrideId', 'overrideId · tmagId · previousSponsorTmagId · newSponsorTmagId · requestingTmagId · reason · performedByTmagId · auditEntryId', 'Append-only sponsor-override history.'],
  ['admin_curated_leader_tags', 'curated_<tmagId>', 'tmagId · curated · setByTmagId · setAt', 'Curated-leader badge.'],
  ['admin_ba_notes', 'noteId', 'noteId · tmagId · text · authorTmagId · createdAt', 'Kevin-private member notes.'],
  ['admin_prospect_notes', 'noteId', 'noteId · prospectId · body · createdByTmagId', 'Kevin-private prospect notes.'],
];
const mongoE = [
  ['vm_lead_batches', 'leadBatchId', 'leadBatchId · ownerTmagId · sponsorTmagId · name · source · country · leadType · status', 'BA-owned acquisition batch.'],
  ['vm_campaigns', 'vmCampaignId', 'vmCampaignId · ownerTmagId · leadBatchId · name · provider · status · adminApprovedForLiveDelivery', 'BA-owned campaign.'],
  ['vm_bulk_leads', 'leadId', 'leadId · leadBatchId · ownerTmagId · vmCampaignId · status · dedupeKey', 'Imported VM/RVM leads.'],
  ['vm_queue_jobs', 'jobId', 'jobId · kind · status · attempts · availableAt', 'Durable VM work queue.'],
  ['vm_delivery_events', 'eventId', 'eventId · provider · leadId · vmCampaignId · ownerTmagId · channel · status · dryRun · attempt', 'VM send/webhook history.'],
  ['vm_provider_webhook_events', 'webhookEventId', 'webhookEventId · provider · payload · status', 'Raw webhook ingestion.'],
  ['vm_audit_events', 'auditId', 'auditId · action · entityId · summary', 'Append-only VM operational audit.'],
  ['vm_suppression_list', '(undetermined)', 'ownerTmagId + (normalizedPhone|normalizedEmail)', 'Do-not-contact list (defer until writer confirmed).'],
  ['broadcasts', 'broadcastId', 'broadcastId · createdByTmagId · isTestSend · audiencePreset · channel · template · recipientCount · status', 'Kevin-only broadcast master.'],
  ['broadcast_recipients', '<bc>::<tmagId>', 'rowId · broadcastId · recipientTmagId · channel · status · attempts · queuedAt', 'One row/recipient.'],
  ['broadcast_optouts', 'tmagId', 'tmagId · reason · addedAt', 'Global permanent STOP list.'],
];
const mongoF = [
  ['mcs_outcomes', 'id', 'envelope + kind(pending|enrolled_iii|became_customer|declined) · confirmedByTmagId · outcomeAt', 'BA-confirmed prospect resolution (R1).'],
  ['mcs_learning_candidates', 'id', 'envelope + status · domain · language · proposedSummary · sourceOutcomeIds[] · review?', 'Review-only proposed learning (R2). No agent may approve.'],
  ['mcs_graphrag_records', 'id', 'envelope + knowledgeObjectId · version · domain · language · summary · model · retrievalReady', 'Active-knowledge retrieval index (R3).'],
];

const neo4j = [
  ['TeamMagnificentMember', 'tmagId', 'SPONSORED_BY→(:TeamMagnificentMember); MEMBER_OF→(:TeamMagnificent); HOLDS_CODE→(:AccessCode)', 'The canonical MEMBER node (downline tree).'],
  ['TeamMagnificent', 'teamKey', '(target of MEMBER_OF / SCOPED_TO)', 'The single team scope node.'],
  ['Prospect', 'prospectId', 'SPONSORED_BY→(:TeamMagnificentMember); HAS_TOKEN→(:InviteToken); IN_HOLDING_TANK→(:Pool)', 'Funnel entity (non-member).'],
  ['Outcome', 'id', 'CONFIRMED_BY→(:TeamMagnificentMember); ABOUT_PROSPECT→(:Prospect); SUPERSEDES; SCOPED_TO→(:TeamMagnificent)', 'R1 outcome lineage.'],
  ['LearningCandidate', 'id', 'DERIVED_FROM→(:Outcome); SCOPED_TO→(:TeamMagnificent)', 'R2 candidate provenance.'],
  ['Knowledge', 'id', 'SCOPED_TO→(:TeamMagnificent); SUPERSEDES', 'R3 active-knowledge nodes.'],
  ['AuditEntry', 'entryId', 'ACTED_FOR→(:TeamMagnificentMember)', 'Shared audit substrate.'],
  ['(business labels)', 'business key', 'InviteToken.token · AccessCode.code · WebinarEvent.eventId · IvoryName.ivoryId · Broadcast.broadcastId · VMCampaign.vmCampaignId · …', 'Per-label uniqueness constraints (P10 §6).'],
];

const chroma = [
  ['Identity/onboarding', 'mcs_team_magnificent_members · mcs_access_codes · mcs_commitments · mcs_ba_questionnaires · mcs_ba_workbooks · mcs_steve_discoveries · mcs_training_progress'],
  ['Prospect/funnel', 'mcs_invitations · mcs_callback_requests · mcs_pool_events · mcs_prospect_accounts · mcs_prospect_magic_links · mcs_webinar_reservations · mcs_prospect_crm · mcs_prospect_timeline'],
  ['Agents/admin', 'mcs_ivory · mcs_agent_events · mcs_audit_log · mcs_tenant_settings · mcs_master_content · mcs_broadcasts'],
  ['VM', 'mcs_vm_lead_batches · mcs_vm_leads · mcs_vm_campaigns · mcs_vm_delivery_events'],
  ['Phase 7 memory', 'mcs_outcomes · mcs_learning_candidates_review (review-only) · 10× mcs_<domain>_knowledge_<lang> (active)'],
];

const enums = [
  ['Prospect / token state', 'minted · clicked · video_started · video_quarter · video_half · video_three_quarter · video_complete · enrolled · expired'],
  ['Outcome / prospect status', 'pending · enrolled_iii · became_customer · declined'],
  ['Webinar attendance', 'yes · no · missed · rescheduled (+ scheduledFor / rescheduledTo)'],
  ['CRM disposition (one enum)', 'new_brand_ambassador · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact'],
  ['Learning domain', 'success · training · relationship · performance · organizational'],
  ['Language', 'en · es'],
  ['Runtime audit action', 'runtime.turn.{opened,draft_emitted,closed} · runtime.gate.{allowed,denied} · runtime.persistence.{enabled,disabled}'],
  ['Persistence mode', 'gateway · direct'],
];

const W = ['22', '14', '42', '22'];
const collTable = (rows) => table(['Collection', 'Key (_id)', 'Core fields', 'Purpose'], rows, W);

const children = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'MOMENTUM CREATION SYSTEM V2', font: FONT, bold: true, size: 22, color: PURPLE })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Canonical Schema List — for Provisioning Approval', font: FONT, bold: true, size: 40, color: INK })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'Team Magnificent · dedicated triple-stack (Mongo momentum@30000 · Neo4j@7710 · Chroma@8200) · post-reidentification canonical names', font: FONT, italics: true, size: 18, color: '5B616E' })] }),
  p([t('This is the canonical schema list for the app’s dedicated triple-stack, using the final canonical names (member = '), t('team_magnificent_members', { mono: true }), t(' / '), t('tmagId', { mono: true }), t(' / '), t(':TeamMagnificentMember', { mono: true }), t('). Nothing is applied to any store. Review, then approve provisioning: Mongoose + $jsonSchema governed doors, Neo4j constraints, and the Chroma registry are applied at '), t('validationLevel:’moderate’', { mono: true }), t(', reversibly.')]),

  h1('0 · Identity & Membership'),
  p([t('Brand Ambassador = a THREE International role. Being a BA does '), t('not', { b: true }), t(' make someone a Team Magnificent member. A '), t('member', { b: true }), t(' is a BA in Kevin’s downline. The app’s canonical entity is the MEMBER (id '), t('tmagId', { mono: true }), t(', value '), t('TMAG-YYYYMMDD-XXXXXX', { mono: true }), t('); the BA credential ('), t('threeBaId', { mono: true }), t(') is an attribute.')]),
  p([t('Eligibility is enforced by ACCESS CODES: to become a member you must be an enrolled III BA AND hold a '), t('TMAG-XXXX', { mono: true }), t(' access code issued by an existing team member (sponsor). Only Kevin mints codes; members reuse their one code to sponsor. Sponsor is immutable.', {})]),

  h1('1 · MongoDB — collections (database momentum)'),
  h2('A · Identity / Access'), collTable(mongoA),
  h2('B · Prospect / Token / Pool / CRM'), collTable(mongoB),
  h2('C · Webinar / Orientation / Training / Steve'), collTable(mongoC),
  h2('D · Agents / Governance / Audit / Admin'), collTable(mongoD),
  h2('E · Voicemail (VM/RVM) / Broadcast'), collTable(mongoE),
  h2('F · Memory / Learning (Phase 7)'), collTable(mongoF),
  p([t('First-pass validator posture (all): required = core above; additionalProperties:true; ISO-string timestamps (never Date); field enums; tighten to additionalProperties:false per-collection after a soak.', { i: true, size: 17 })]),

  h1('2 · Neo4j — labels & constraints (@7710)'),
  table(['Label', 'Key', 'Relationships', 'Purpose'], neo4j, ['20', '14', '44', '22']),

  h1('3 · ChromaDB — collections (mcs_ prefixed, 384-dim, @8200)'),
  table(['Group', 'Collections'], chroma, ['22', '78']),

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
