import type { McsVmCampaignProvider } from './types.js';

export type McsVmProviderAvailability =
  | 'selectable'
  | 'registered_dormant'
  | 'planned'
  | 'unavailable';

export interface McsVmProviderCatalogEntry {
  key: McsVmCampaignProvider;
  label: string;
  help: string;
  availability: McsVmProviderAvailability;
  supportsLiveSend: boolean;
  liveDelivery: 'never' | 'governance_locked';
}

export const VM_REGISTERED_PROVIDER_KEYS = [
  'manual_csv',
  'acquisition_provider_placeholder',
  'telnyx_call_control',
] as const satisfies readonly McsVmCampaignProvider[];

export const VM_CAMPAIGN_SELECTABLE_PROVIDER_KEYS = [
  'manual_csv',
  'telnyx_call_control',
] as const satisfies readonly McsVmCampaignProvider[];

export const VM_PROVIDER_CATALOG: readonly McsVmProviderCatalogEntry[] = [
  {
    key: 'manual_csv',
    label: 'Manual CSV',
    help: 'Owner export, no live dialer.',
    availability: 'selectable',
    supportsLiveSend: false,
    liveDelivery: 'never',
  },
  {
    key: 'acquisition_provider_placeholder',
    label: 'Provider placeholder',
    help: 'Registered dry-run adapter; campaign selection remains governance-locked.',
    availability: 'registered_dormant',
    supportsLiveSend: true,
    liveDelivery: 'governance_locked',
  },
  {
    key: 'telnyx_call_control',
    label: 'Telnyx Call Control',
    help: 'Live-capable only after the global lock and campaign admin approval.',
    availability: 'selectable',
    supportsLiveSend: true,
    liveDelivery: 'governance_locked',
  },
  {
    key: 'leadsrain_style_adapter',
    label: 'LeadsRain-style adapter',
    help: 'Planned provider-mode integration; not selectable.',
    availability: 'planned',
    supportsLiveSend: false,
    liveDelivery: 'governance_locked',
  },
  {
    key: 'slybroadcast_style_adapter',
    label: 'Slybroadcast-style adapter',
    help: 'Planned provider-mode integration; not selectable.',
    availability: 'planned',
    supportsLiveSend: false,
    liveDelivery: 'governance_locked',
  },
  {
    key: 'future_telecom_adapter',
    label: 'Future telecom adapter',
    help: 'Reserved provider identity; not selectable.',
    availability: 'planned',
    supportsLiveSend: false,
    liveDelivery: 'governance_locked',
  },
  {
    key: 'none',
    label: 'None',
    help: 'No delivery provider.',
    availability: 'unavailable',
    supportsLiveSend: false,
    liveDelivery: 'never',
  },
];

export const VM_CAMPAIGN_SELECTABLE_PROVIDER_OPTIONS = VM_PROVIDER_CATALOG.filter(
  (entry) => entry.availability === 'selectable',
);

export const VM_PROVIDER_LABELS = Object.fromEntries(
  VM_PROVIDER_CATALOG.map((entry) => [entry.key, entry.label]),
) as Record<McsVmCampaignProvider, string>;
