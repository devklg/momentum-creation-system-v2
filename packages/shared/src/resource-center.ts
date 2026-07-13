import type { McsResourceKind } from './resource-catalog.js';

export const MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION = 'resource_center.v1' as const;

export interface McsResourceCenterItem {
  resourceId: string;
  resourceVersionId: string;
  title: string;
  summary: string;
  kind: McsResourceKind;
  categories: string[];
  tags: string[];
  languageCode: 'en' | 'es' | null;
  version: number;
  sourceSystem: string;
  openTarget: string | null;
  updatedAt: string;
}

export interface McsResourceCenterResponse {
  ok: true;
  schemaVersion: typeof MCS_RESOURCE_CENTER_RESPONSE_SCHEMA_VERSION;
  items: McsResourceCenterItem[];
  categories: string[];
  kinds: McsResourceKind[];
}
