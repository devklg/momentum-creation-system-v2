import type {
  McsOrientationSessionAvailability,
  McsOrientationSessionWithRoster,
  McsWebinarEvent,
} from './types.js';

export const MCS_EVENT_CENTER_SCHEMA_VERSION = 'event_center.v1' as const;

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

export interface McsEventCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_EVENT_CENTER_SCHEMA_VERSION;
  generatedAt: string;
  sources: McsEventCenterSourceHealth;
  orientationSessions: McsOrientationSessionAvailability[];
  myOrientationReservationSessionId: string | null;
  webinarEvents: McsEventCenterWebinarEvent[];
}

export interface McsAdminEventCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_EVENT_CENTER_SCHEMA_VERSION;
  generatedAt: string;
  sources: McsEventCenterSourceHealth;
  orientationSessions: McsOrientationSessionWithRoster[];
  webinarEvents: McsAdminEventCenterWebinarEvent[];
}
