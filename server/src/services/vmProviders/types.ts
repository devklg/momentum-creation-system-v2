import type { VmBulkLeadRecord, VmProviderKey } from '../../domain/vmProviderQueue.js';

export interface VoicemailDropPayload {
  lead: VmBulkLeadRecord;
  tokenUrl: string;
  campaignId: string;
  dryRun: boolean;
  adminApprovedForLiveDelivery: boolean;
}

export interface DropResult {
  provider: VmProviderKey;
  providerMessageId: string | null;
  status:
    | 'dry_run'
    | 'manual_export_ready'
    | 'voicemail_drop_queued'
    | 'voicemail_drop_delivered'
    | 'voicemail_drop_failed';
  dryRun: boolean;
  details: Record<string, unknown>;
}

export interface DropStatus {
  providerMessageId: string;
  status: string;
  details: Record<string, unknown>;
}

export interface RinglessVoicemailProvider {
  key: VmProviderKey;
  label: string;
  supportsLiveSend: boolean;
  sendDrop(payload: VoicemailDropPayload): Promise<DropResult>;
  getStatus(providerMessageId: string): Promise<DropStatus>;
  handleWebhook(payload: unknown): Promise<Record<string, unknown>>;
}
