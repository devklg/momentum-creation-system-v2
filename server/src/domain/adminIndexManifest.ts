export interface AdminRequiredIndex {
  collection: string;
  name: string;
  keys: Record<string, 1 | -1>;
  surface: string;
}

export const ADMIN_REQUIRED_INDEXES: readonly AdminRequiredIndex[] = [
  { collection: 'team_magnificent_members', name: 'admin_createdAt_tmagId', keys: { createdAt: -1, tmagId: -1 }, surface: 'ba_directory' },
  { collection: 'tmag_access_codes', name: 'admin_owner_active', keys: { sponsorTmagId: 1, active: 1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_commitments', name: 'admin_tmagId_acceptedAt', keys: { tmagId: 1, acceptedAt: -1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_prospect_invite_tokens', name: 'admin_sponsor_createdAt', keys: { sponsorTmagId: 1, createdAt: -1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_prospect_crm_followups', name: 'admin_sponsor_open_dueAt', keys: { sponsorTmagId: 1, clearedAt: 1, dueAt: 1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_fast_start_progress', name: 'admin_tmagId_state', keys: { tmagId: 1, state: 1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_admin_curated_leader_tags', name: 'admin_tmagId', keys: { tmagId: 1 }, surface: 'ba_directory_join' },
  { collection: 'tmag_prospects', name: 'admin_createdAt_prospectId', keys: { createdAt: -1, prospectId: -1 }, surface: 'prospect_directory' },
  { collection: 'tmag_prospects', name: 'admin_sponsor_createdAt_prospectId', keys: { sponsorTmagId: 1, createdAt: -1, prospectId: -1 }, surface: 'prospect_directory' },
  { collection: 'tmag_prospect_htank_placements', name: 'admin_prospectId', keys: { prospectId: 1 }, surface: 'prospect_directory_join' },
  { collection: 'tmag_prospect_invite_tokens', name: 'admin_prospect_createdAt', keys: { prospectId: 1, createdAt: -1 }, surface: 'prospect_directory_join' },
  { collection: 'tmag_prospect_callback_requests', name: 'admin_prospect_createdAt', keys: { prospectId: 1, createdAt: -1 }, surface: 'prospect_directory_join' },
  { collection: 'tmag_prospect_webinar_reservations', name: 'admin_prospect_createdAt', keys: { prospectId: 1, createdAt: -1 }, surface: 'prospect_directory_join' },
  { collection: 'tmag_prospect_webinar_reservations', name: 'admin_event_createdAt_reservationId', keys: { eventId: 1, createdAt: -1, reservationId: -1 }, surface: 'event_reservations' },
  { collection: 'tmag_event_attendance', name: 'admin_event_type_reservation_recordedAt', keys: { eventId: 1, eventType: 1, reservationId: 1, recordedAt: -1 }, surface: 'event_aggregate' },
  { collection: 'tmag_event_attendance', name: 'admin_reservation_type_recordedAt', keys: { reservationId: 1, eventType: 1, recordedAt: -1 }, surface: 'event_page_join' },
  { collection: 'tmag_prospect_crm_followups', name: 'admin_prospect_sponsor_cleared_dueAt', keys: { prospectId: 1, sponsorTmagId: 1, clearedAt: 1, dueAt: 1 }, surface: 'event_followup_join' },
  { collection: 'tmag_resource_catalog', name: 'admin_active_team_updatedAt_resourceVersionId', keys: { lifecycle: 1, 'audience.surfaces': 1, updatedAt: -1, resourceVersionId: -1 }, surface: 'resource_analytics' },
  { collection: 'tmag_resource_usage_events', name: 'admin_version_event_occurredAt', keys: { resourceVersionId: 1, eventType: 1, occurredAt: -1 }, surface: 'resource_analytics_join' },
  { collection: 'mcs_audit_log', name: 'admin_timestamp_entryId', keys: { timestamp: -1, entryId: -1 }, surface: 'audit_log' },
  { collection: 'mcs_audit_log', name: 'admin_severity_timestamp_entryId', keys: { severity: 1, timestamp: -1, entryId: -1 }, surface: 'audit_log' },
  { collection: 'mcs_audit_log', name: 'admin_entity_timestamp_entryId', keys: { 'entity.kind': 1, 'entity.id': 1, timestamp: -1, entryId: -1 }, surface: 'audit_log' },
] as const;
