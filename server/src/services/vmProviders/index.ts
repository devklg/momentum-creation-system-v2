import { acquisitionProvider } from './acquisitionProvider.js';
import { manualCsvProvider } from './manualCsv.js';
import type { RinglessVoicemailProvider } from './types.js';
import type { VmProviderKey } from '../../domain/vmProviderQueue.js';

const providers: Record<VmProviderKey, RinglessVoicemailProvider> = {
  manual_csv: manualCsvProvider,
  acquisition_provider_placeholder: acquisitionProvider,
};

export function getVmProvider(key: VmProviderKey): RinglessVoicemailProvider {
  return providers[key];
}

export function listVmProviders(): Array<{
  key: VmProviderKey;
  label: string;
  supportsLiveSend: boolean;
}> {
  return Object.values(providers).map((provider) => ({
    key: provider.key,
    label: provider.label,
    supportsLiveSend: provider.supportsLiveSend,
  }));
}

export type { DropResult, DropStatus, RinglessVoicemailProvider, VoicemailDropPayload } from './types.js';
