import { env } from '../env.js';
import { buildManualCsv } from '../services/vmProviders/manualCsv.js';
import { listDeliveryRowsForManualExport } from './vmProviderQueue.js';

export async function buildManualExportCsv(
  vmCampaignId: string,
  ownerTmagId?: string,
): Promise<string> {
  const rows = await listDeliveryRowsForManualExport(vmCampaignId, ownerTmagId);
  return buildManualCsv(rows, env.PROSPECT_BASE_URL.replace(/\/$/, ''));
}
