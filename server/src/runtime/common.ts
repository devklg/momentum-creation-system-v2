export type BackendRuntimeBoundaryKey =
  | 'knowledge_core'
  | 'context_manager'
  | 'agent_runtime'
  | 'event_runtime'
  | 'browser_voice_text_runtime';

export interface BackendRuntimeBoundaryDescriptor<
  TKey extends BackendRuntimeBoundaryKey = BackendRuntimeBoundaryKey,
> {
  key: TKey;
  label: string;
  status: 'skeleton_only';
  activated: false;
  apiMounted: false;
  behaviorEnabled: false;
  persistenceAccess: 'service_boundary_only';
  sharedContractImport: '@momentum/shared/runtime';
  notes: readonly string[];
}

export function defineRuntimeBoundary<TKey extends BackendRuntimeBoundaryKey>(
  descriptor: BackendRuntimeBoundaryDescriptor<TKey>,
): BackendRuntimeBoundaryDescriptor<TKey> {
  return descriptor;
}
