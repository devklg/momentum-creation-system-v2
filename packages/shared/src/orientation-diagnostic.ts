export const MCS_ORIENTATION_DIAGNOSTIC_VERSION = 'orientation_diagnostic.v1' as const;

export type McsOrientationDiagnosticCategory =
  | 'stuck'
  | 'duplicate'
  | 'inconsistent';

export type McsOrientationDiagnosticCode =
  | 'elapsed_active_reservation'
  | 'duplicate_session_id'
  | 'duplicate_reservation_id'
  | 'duplicate_active_reservations_for_ba'
  | 'duplicate_active_reservations_for_ba_session'
  | 'invalid_session_record'
  | 'invalid_reservation_record'
  | 'reservation_without_session'
  | 'reservation_schedule_mismatch'
  | 'active_reservation_for_cancelled_session'
  | 'future_session_marked_past'
  | 'session_over_capacity';

export interface McsOrientationDiagnosticFinding {
  category: McsOrientationDiagnosticCategory;
  code: McsOrientationDiagnosticCode;
  sessionId: string | null;
  reservationId: string | null;
  tmagId: string | null;
  detail: string;
  evidence: Record<string, unknown>;
  repairPolicy: 'report_only';
}

export interface McsAdminOrientationDiagnosticResponse {
  ok: true;
  schemaVersion: typeof MCS_ORIENTATION_DIAGNOSTIC_VERSION;
  stateSchemaVersion: 'orientation_state.v1';
  generatedAt: string;
  policy: 'report_only';
  sourceAuthority: {
    sessions: 'tmag_new_member_orientation_sessions';
    reservations: 'tmag_new_member_orientation_reservations';
  };
  attendanceAuthority: null;
  completionAuthority: null;
  completionInferred: false;
  autoRepair: false;
  scanLimit: number;
  scanLimitReached: {
    sessions: boolean;
    reservations: boolean;
  };
  scanned: {
    sessions: number;
    reservations: number;
  };
  totals: {
    stuck: number;
    duplicate: number;
    inconsistent: number;
    findings: number;
  };
  findings: McsOrientationDiagnosticFinding[];
}
