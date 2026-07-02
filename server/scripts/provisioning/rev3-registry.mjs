// MCS v2 — Rev 3 canonical registry (signed by Kevin 2026-07-02)
// Source of truth: engineering/reports/MCS_V2_CANONICAL_SCHEMAS_REV3.md
// One base name per concept; store-deterministic prefixes (Ruling 10/12a):
//   Mongo=tmag_ · Chroma=mcs_ · Neo4j=Tmag* (member: TeamMagnificentMember)
// Used by provision-mongo/neo4j/chroma — local stack AND cloud (B1) alike.

export const REV = 'rev3-signed-2026-07-02';

// ---------------- MongoDB (database: momentum) ----------------
// First-pass validator posture: required = core; additionalProperties: true;
// ISO-string timestamps; enums where closed. validationLevel: moderate.
export const ENUMS = {
  tokenState: ['minted','clicked','video_started','video_quarter','video_half','video_three_quarter','video_complete','enrolled','expired'],
  outcomeKind: ['pending','enrolled_iii','became_customer','declined'],
  attendance: ['yes','no','missed','rescheduled'],
  crmDisposition: ['new_brand_ambassador','new_customer','interested','not_interested','later','no_response','wrong_number','do_not_contact'],
  templateKind: ['learning','interviewing','invitation'],
  learningDomain: ['success','training','relationship','performance','organizational'],
  language: ['en','es'],
  workbookStatus: ['draft','final'],
  challengeChannel: ['email','phone'],
  mintedVia: ['kevin','agent'],
};

export const MONGO_COLLECTIONS = [
  // A · Identity / Access
  { name: 'team_magnificent_members', required: ['tmagId','firstName','lastName','email','createdAt'] },
  { name: 'tmag_access_codes', required: ['code','sponsorTmagId','createdAt','active'], props: { mintedVia: { enum: ENUMS.mintedVia } } },
  { name: 'tmag_commitments', required: ['commitmentId','tmagId','version','acceptedAt'] },
  { name: 'tmag_workbooks', required: ['workbookId','forTmagId','conductedByTmagId','status'], props: { status: { enum: ENUMS.workbookStatus } } },
  { name: 'tmag_profile_change_challenges', required: ['challengeId','tmagId','channel','codeHash','issuedAt','expiresAt'], props: { channel: { enum: ENUMS.challengeChannel } } },
  // B · Prospect / Token / Holding-tank / CRM
  { name: 'tmag_prospects', required: ['prospectId','firstName','sponsorTmagId','state'], props: { state: { enum: ENUMS.tokenState } } },
  { name: 'tmag_prospect_invite_tokens', required: ['token','prospectId','sponsorTmagId','state','createdAt','expiresAt'], props: { state: { enum: ENUMS.tokenState } } },
  { name: 'tmag_prospect_invitation_activity', required: ['activityId','prospectId','sponsorTmagId','kind','at'] },
  { name: 'tmag_prospect_htank_counters', required: ['current','createdAt'] },
  { name: 'tmag_prospect_htank_placements', required: ['prospectId','sponsorTmagId','positionNumber','placedAt'] },
  { name: 'tmag_prospect_htank_accounts', required: ['accountId','prospectId','tokenId','sponsorTmagId'] },
  { name: 'tmag_prospect_magic_links', required: ['linkToken','accountId','tokenId','issuedAt','expiresAt'] },
  { name: 'tmag_prospect_sessions', required: ['sessionId','accountId','prospectId','tokenId','sponsorTmagId'] },
  { name: 'tmag_prospect_callback_requests', required: ['callbackRequestId','token','prospectId','sponsorTmagId','intent'] },
  { name: 'tmag_prospect_crm_notes', required: ['noteId','prospectId','sponsorTmagId','text','createdAt'] },
  { name: 'tmag_prospect_crm_followups', required: ['followUpId','prospectId','sponsorTmagId','dueAt'] },
  { name: 'tmag_prospect_crm_dispositions', required: ['prospectId','sponsorTmagId','disposition','updatedAt'], props: { disposition: { enum: ENUMS.crmDisposition } } },
  { name: 'tmag_prospect_crm_records', required: ['crmRecordId','prospectId','ownerTmagId','sponsorTmagId','status'] },
  { name: 'tmag_prospect_timeline_events', required: ['eventId','prospectId','sponsorTmagId','kind','occurredAt'] },
  // C · Webinar / Orientation / Training / Steve
  { name: 'tmag_prospect_webinar_events', required: ['eventId','scheduledFor','status'] },
  { name: 'tmag_prospect_webinar_reservations', required: ['reservationId','eventId','token','prospectId','sponsorTmagId','scheduledFor'], props: { attendance: { enum: ENUMS.attendance } } },
  { name: 'tmag_new_member_orientation_sessions', required: ['sessionId','scheduledFor','capacity','status'] },
  { name: 'tmag_new_member_orientation_reservations', required: ['reservationId','sessionId','tmagId','scheduledFor','status'] },
  { name: 'tmag_fast_start_progress', required: ['tmagId','moduleId','state'] },
  { name: 'tmag_steve_success_interview', required: ['tmagId','successProfile'] },
  // D · Agents / Templates / Governance / Audit / Admin
  { name: 'tmag_agent_ivory_events', required: ['eventId','tmagId','agentId','kind','createdAt'] },
  { name: 'tmag_agent_michael_events', required: ['eventId','tmagId','agentId','kind','createdAt'] },
  { name: 'tmag_agent_steve_events', required: ['eventId','tmagId','agentId','kind','createdAt'] },
  { name: 'tmag_agent_templates', required: ['templateId','agentKey','templateKind','version'], props: { templateKind: { enum: ENUMS.templateKind } } },
  { name: 'tmag_content_templates', required: ['templateVersionId','tenantId','templateKey','surface','version'] },
  { name: 'tmag_invitation_generator_runs', required: ['runId','tmagId','productKey'] },
  { name: 'tmag_ivory_prospect_names', required: ['ivoryId','tmagId','firstName','status'] },
  { name: 'mcs_audit_log', required: ['entryId','timestamp','role','actor','action'] },
  { name: 'tmag_projection_outbox', required: ['outboxId','tier','target','entityId','status'] },
  { name: 'tenant_settings_versions', required: ['settingsVersionId','version','tenantId'] },
  { name: 'tmag_admin_settings', required: ['value'] },
  { name: 'tmag_admin_sponsor_overrides', required: ['overrideId','tmagId','previousSponsorTmagId','newSponsorTmagId','reason','performedByTmagId','auditEntryId'] },
  { name: 'tmag_admin_curated_leader_tags', required: ['tmagId','curated','setByTmagId','setAt'] },
  { name: 'tmag_admin_member_notes', required: ['noteId','tmagId','text','authorTmagId','createdAt'] },
  { name: 'tmag_admin_prospect_notes', required: ['noteId','prospectId','body','createdByTmagId'] },
  // E · VM / Broadcast  (tmag_vm_suppression_list DEFERRED — no confirmed writer)
  { name: 'tmag_vm_lead_owners', required: ['leadOwnerId','ownerTmagId','name','source','status'] },
  { name: 'tmag_vm_campaigns', required: ['vmCampaignId','ownerTmagId','leadOwnerId','name','provider','status'] },
  { name: 'tmag_vm_bulk_leads', required: ['leadId','leadOwnerId','ownerTmagId','status'] },
  { name: 'tmag_vm_queue_jobs', required: ['jobId','kind','status','availableAt'] },
  { name: 'tmag_vm_delivery_events', required: ['eventId','provider','leadId','ownerTmagId','channel','status'] },
  { name: 'tmag_vm_provider_webhook_events', required: ['webhookEventId','provider','status'] },
  { name: 'tmag_vm_audit_events', required: ['auditId','action','entityId','summary'] },
  { name: 'tmag_broadcasts', required: ['broadcastId','createdByTmagId','channel','status'] },
  { name: 'tmag_broadcast_recipients', required: ['rowId','broadcastId','recipientTmagId','channel','status'] },
  { name: 'tmag_broadcast_optouts', required: ['tmagId','addedAt'] },
  // F · Memory / Learning (system)
  { name: 'mcs_outcomes', required: ['kind','confirmedByTmagId','outcomeAt'], props: { kind: { enum: ENUMS.outcomeKind } } },
  { name: 'mcs_learning_candidates', required: ['status','domain','language','proposedSummary'], props: { domain: { enum: ENUMS.learningDomain }, language: { enum: ENUMS.language } } },
  { name: 'mcs_graphrag_records', required: ['knowledgeObjectId','version','domain','language','summary'], props: { domain: { enum: ENUMS.learningDomain }, language: { enum: ENUMS.language } } },
];

// ---------------- ChromaDB (@8200 local / Chroma Cloud in B1) ----------------
// Ruling 10/12a: EVERY Chroma collection takes mcs_ + base name. 384-dim,
// all-MiniLM-L6-v2 provenance stamped in metadata (records add model_version).
const KNOWLEDGE = [];
for (const d of ENUMS.learningDomain) for (const l of ENUMS.language) KNOWLEDGE.push(`mcs_${d}_knowledge_${l}`);

export const CHROMA_COLLECTIONS = [
  // Identity / onboarding
  'mcs_members','mcs_access_codes','mcs_commitments','mcs_workbooks','mcs_steve_success_interview','mcs_fast_start_progress',
  // Prospect / funnel
  'mcs_prospect_invitation_activity','mcs_prospect_callback_requests','mcs_prospect_htank_events','mcs_prospect_magic_links','mcs_prospect_webinar_reservations','mcs_prospect_crm_records','mcs_prospect_timeline_events',
  // Agents / templates / admin
  'mcs_agent_ivory_events','mcs_agent_michael_events','mcs_agent_steve_events','mcs_agent_templates','mcs_ivory_prospect_names','mcs_audit_log','mcs_content_templates','mcs_broadcasts',
  // VM
  'mcs_vm_lead_owners','mcs_vm_bulk_leads','mcs_vm_campaigns','mcs_vm_delivery_events',
  // Memory / learning
  'mcs_outcomes','mcs_learning_candidates_review',
  ...KNOWLEDGE,
];

export const CHROMA_METADATA = {
  project: 'momentum_creation_system_v2',
  schema_rev: REV,
  expected_dim: 384,
  embedding_model: 'all-MiniLM-L6-v2',
  purpose: 'rev3 canonical registry',
};

// ---------------- Neo4j (@7710 local / Aura in B1) ----------------
export const NEO4J_CONSTRAINTS = [
  ['TeamMagnificentMember','tmagId'], ['TeamMagnificent','teamKey'],
  ['TmagAccessCode','code'], ['TmagCommitment','commitmentId'], ['TmagWorkbook','workbookId'], ['TmagProfileChangeChallenge','challengeId'],
  ['TmagProspect','prospectId'], ['TmagInviteToken','token'], ['TmagInvitationActivity','activityId'],
  ['TmagPool','id'], ['TmagHtankPlacement','prospectId'], ['TmagHtankAccount','accountId'], ['TmagMagicLink','linkToken'],
  ['TmagCallbackRequest','callbackRequestId'], ['TmagCrmNote','noteId'], ['TmagCrmFollowup','followUpId'], ['TmagCrmDisposition','id'],
  ['TmagProspectCrmRecord','crmRecordId'], ['TmagProspectTimelineEvent','eventId'],
  ['TmagWebinarEvent','eventId'], ['TmagWebinarReservation','reservationId'],
  ['TmagOrientationSession','sessionId'], ['TmagOrientationReservation','reservationId'],
  ['TmagFastStartProgress','id'], ['TmagSteveSuccessInterview','id'],
  ['TmagAgentIvoryEvent','eventId'], ['TmagAgentMichaelEvent','eventId'], ['TmagAgentSteveEvent','eventId'],
  ['TmagAgentTemplate','templateId'], ['TmagContentTemplate','templateVersionId'], ['TmagInvitationGeneratorRun','runId'],
  ['TmagIvoryName','ivoryId'], ['TmagAuditEntry','entryId'], ['TmagSponsorOverride','overrideId'],
  ['TmagCuratedLeaderTag','id'], ['TmagAdminMemberNote','noteId'], ['TmagAdminProspectNote','noteId'],
  ['TmagVmLeadOwner','leadOwnerId'], ['TmagVmCampaign','vmCampaignId'], ['TmagVmBulkLead','leadId'],
  ['TmagVmQueueJob','jobId'], ['TmagVmDeliveryEvent','eventId'], ['TmagVmProviderWebhook','webhookEventId'], ['TmagVmAuditEvent','auditId'],
  ['TmagBroadcast','broadcastId'], ['TmagBroadcastRecipient','rowId'], ['TmagBroadcastOptout','tmagId'],
  ['TmagOutcome','id'], ['TmagLearningCandidate','id'], ['TmagKnowledge','id'],
];

export const NEO4J_INDEXES = [
  ['TmagProspect','sponsorTmagId'], ['TmagProspect','state'],
  ['TmagInviteToken','prospectId'], ['TmagInviteToken','sponsorTmagId'],
  ['TmagVmLeadOwner','ownerTmagId'], ['TmagVmBulkLead','ownerTmagId'],
  ['TmagCrmNote','sponsorTmagId'], ['TeamMagnificentMember','email'], ['TmagAuditEntry','entityId'],
];
