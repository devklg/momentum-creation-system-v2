import type {
  DropResult,
  DropStatus,
  RinglessVoicemailProvider,
  VoicemailDropPayload,
} from './types.js';

export const manualCsvProvider: RinglessVoicemailProvider = {
  key: 'manual_csv',
  label: 'Manual CSV export',
  supportsLiveSend: false,

  async sendDrop(payload: VoicemailDropPayload): Promise<DropResult> {
    return {
      provider: 'manual_csv',
      providerMessageId: null,
      status: payload.dryRun ? 'dry_run' : 'manual_export_ready',
      dryRun: true,
      details: {
        mode: 'manual_csv',
        leadId: payload.lead.leadId,
        tokenUrl: payload.tokenUrl,
        note: 'No live voicemail-drop provider was called. Export this row for manual provider upload.',
      },
    };
  },

  async getStatus(providerMessageId: string): Promise<DropStatus> {
    return {
      providerMessageId,
      status: 'manual_mode_no_remote_status',
      details: { mode: 'manual_csv' },
    };
  },

  async handleWebhook(payload: unknown): Promise<Record<string, unknown>> {
    return {
      status: 'ignored_manual_mode',
      payload: payload && typeof payload === 'object' ? payload : { value: payload },
    };
  },
};

export function buildManualCsv(leads: Array<{ normalizedPhone: string | null; firstName: string | null; lastName: string | null; token: string | null; ownerTmBaId: string; leadId: string }>, baseUrl: string): string {
  const headers = ['leadId', 'phone', 'firstName', 'lastName', 'rvmLink', 'ownerTmBaId'];
  const rows = leads.map((lead) => [
    lead.leadId,
    lead.normalizedPhone ?? '',
    lead.firstName ?? '',
    lead.lastName ?? '',
    lead.token ? `${baseUrl}/rvm/${lead.token}` : '',
    lead.ownerTmBaId,
  ]);
  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
