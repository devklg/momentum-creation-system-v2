import type { VmBulkLeadRecord, VmProviderKey } from '../../domain/vmProviderQueue.js';

export const VM_PROVIDER_MAX_COOLDOWN_MS = 15 * 60_000;

export function parseVmProviderRetryAfterMs(
  value: string | null | undefined,
  nowMs = Date.now(),
  maxMs = VM_PROVIDER_MAX_COOLDOWN_MS,
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  const rawMs = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(trimmed) - nowMs;
  if (!Number.isFinite(rawMs) || rawMs <= 0) return null;
  return Math.min(maxMs, Math.ceil(rawMs));
}

export class VmProviderRateLimitError extends Error {
  readonly code = 'provider_rate_limited';

  constructor(
    public readonly provider: VmProviderKey,
    public readonly retryAfterMs: number | null,
    public readonly httpStatus = 429,
  ) {
    super('provider_rate_limited');
    this.name = 'VmProviderRateLimitError';
  }
}

export interface VoicemailDropPayload {
  lead: VmBulkLeadRecord;
  tokenUrl: string;
  campaignId: string;
  audioUrl: string | null;
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
