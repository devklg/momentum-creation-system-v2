import { acquisitionProvider } from './acquisitionProvider.js';
import { manualCsvProvider } from './manualCsv.js';
import { telnyxCallControlProvider } from './telnyxCallControl.js';
import type { RinglessVoicemailProvider } from './types.js';
import type { VmProviderKey } from '../../domain/vmProviderQueue.js';
import {
  VM_REGISTERED_PROVIDER_KEYS,
} from '@momentum/shared';

export {
  VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS,
  VM_PROVIDER_CATALOG,
  VM_REGISTERED_PROVIDER_KEYS,
} from '@momentum/shared';

const providers: Record<VmProviderKey, RinglessVoicemailProvider> = {
  manual_csv: manualCsvProvider,
  acquisition_provider_placeholder: acquisitionProvider,
  telnyx_call_control: telnyxCallControlProvider,
};

const providerKeySet = new Set<string>(VM_REGISTERED_PROVIDER_KEYS);

export function isVmProviderKey(value: unknown): value is VmProviderKey {
  return typeof value === 'string' && providerKeySet.has(value);
}

export function getVmProvider(key: unknown): RinglessVoicemailProvider {
  if (!isVmProviderKey(key)) {
    throw new Error('unsupported_vm_provider');
  }
  return providers[key];
}

export function listVmProviders(): Array<{
  key: VmProviderKey;
  label: string;
  supportsLiveSend: boolean;
}> {
  return VM_REGISTERED_PROVIDER_KEYS.map((key) => {
    const provider = providers[key];
    return {
      key: provider.key,
      label: provider.label,
      supportsLiveSend: provider.supportsLiveSend,
    };
  });
}

export type { DropResult, DropStatus, RinglessVoicemailProvider, VoicemailDropPayload } from './types.js';
