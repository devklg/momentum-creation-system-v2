import type {
  McsOrientationSessionAvailability,
  McsOrientationSessionWithRoster,
  McsWebinarEvent,
} from './types.js';

export const MCS_EVENT_CENTER_SCHEMA_VERSION = 'event_center.v1.2' as const;

export type McsEventCenterSourceStatus = 'available' | 'unavailable';

export interface McsEventCenterSourceHealth {
  orientation: McsEventCenterSourceStatus;
  webinar: McsEventCenterSourceStatus;
}

export interface McsEventCenterWebinarEvent extends McsWebinarEvent {
  audience: 'prospect';
  reservationMode: 'invitation_token_only';
}

export interface McsAdminEventCenterWebinarEvent extends McsEventCenterWebinarEvent {
  reservationCount: number;
}

export type McsEventCenterEventType = 'new_member_orientation' | 'prospect_webinar';

export interface McsEventCenterVisibility {
  team: 'authenticated';
  admin: 'founder_admin';
  prospect: 'none' | 'invitation_token_only';
}

export interface McsEventCenterCapacity {
  mode: 'limited' | 'unlimited';
  limit: number | null;
  reserved: number | null;
  remaining: number | null;
}

export interface McsEventCenterRegistration {
  owner: 'orientation' | 'prospect_webinar';
  mode: 'ba_self_service' | 'prospect_invitation_token';
  state: 'available' | 'full' | 'reserved_by_me' | 'invitation_required';
}

export interface McsEventCenterReminders {
  owner: 'source_domain';
  status: 'not_configured' | 'configured';
  channels: Array<'email' | 'sms' | 'in_app'>;
}

export interface McsEventCenterAttendance {
  state: 'not_recorded' | 'recorded' | 'unavailable';
  recordedAt: string | null;
  inferred: false;
  counts: {
    recorded: number;
    attended: number;
    missed: number;
    rescheduled: number;
  };
}

export interface McsEventCenterFollowUp {
  owner: 'human_crm';
  connection: 'not_connected' | 'available' | 'unavailable';
  automated: false;
  connectedCount: number;
}

export type McsEventAttendanceState = 'attended' | 'missed' | 'rescheduled';

export interface McsEventAttendanceRecord {
  attendanceId: string;
  eventId: string;
  reservationId: string;
  eventType: 'prospect_webinar';
  prospectId: string;
  sponsorTmagId: string;
  state: McsEventAttendanceState;
  recordedAt: string;
  recordedByTmagId: string;
  crmFollowUpDueAt: string;
}

export interface McsAdminEventCenterWebinarReservation {
  reservationId: string;
  eventId: string;
  prospectId: string;
  sponsorTmagId: string;
  name: string;
  createdAt: string;
  attendance: McsEventAttendanceState | null;
  attendanceRecordedAt: string | null;
  crmFollowUpDueAt: string | null;
}

export interface McsRecordEventAttendancePayload {
  state: McsEventAttendanceState;
}

export interface McsRecordEventAttendanceResponse {
  ok: true;
  attendance: McsEventAttendanceRecord;
  followUp: {
    connection: 'available';
    dueAt: string;
    created: boolean;
    automatedContact: false;
  };
}

export interface McsEventCenterEvent {
  eventId: string;
  sourceId: string;
  eventType: McsEventCenterEventType;
  visibility: McsEventCenterVisibility;
  scheduledFor: string;
  hosts: string[];
  durationMinutes: number;
  status: 'upcoming' | 'past' | 'cancelled';
  capacity: McsEventCenterCapacity;
  registration: McsEventCenterRegistration;
  reminders: McsEventCenterReminders;
  attendance: McsEventCenterAttendance;
  followUp: McsEventCenterFollowUp;
}

export interface McsEventCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_EVENT_CENTER_SCHEMA_VERSION;
  generatedAt: string;
  sources: McsEventCenterSourceHealth;
  events: McsEventCenterEvent[];
  orientationSessions: McsOrientationSessionAvailability[];
  myOrientationReservationSessionId: string | null;
  webinarEvents: McsEventCenterWebinarEvent[];
}

export interface McsAdminEventCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_EVENT_CENTER_SCHEMA_VERSION;
  generatedAt: string;
  sources: McsEventCenterSourceHealth;
  dependencies: {
    attendance: McsEventCenterSourceStatus;
    crm: McsEventCenterSourceStatus;
  };
  events: McsEventCenterEvent[];
  orientationSessions: McsOrientationSessionWithRoster[];
  webinarEvents: McsAdminEventCenterWebinarEvent[];
  webinarReservations: McsAdminEventCenterWebinarReservation[];
}
