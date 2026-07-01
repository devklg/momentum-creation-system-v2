export type RuntimeBrand<TValue, TBrand extends string> = TValue & {
  readonly __runtimeBrand: TBrand;
};

export type TenantId = RuntimeBrand<string, 'TenantId'>;
export type TeamId = RuntimeBrand<string, 'TeamId'>;
export type TmagId = RuntimeBrand<string, 'TmagId'>;
export type AgentId = RuntimeBrand<string, 'AgentId'>;
export type RequestId = RuntimeBrand<string, 'RequestId'>;
export type SessionId = RuntimeBrand<string, 'SessionId'>;
export type RuntimeEventId = RuntimeBrand<string, 'RuntimeEventId'>;
export type ContextPacketId = RuntimeBrand<string, 'ContextPacketId'>;
export type ContextRequestId = RuntimeBrand<string, 'ContextRequestId'>;
export type KnowledgeId = RuntimeBrand<string, 'KnowledgeId'>;
export type KnowledgeCandidateId = RuntimeBrand<string, 'KnowledgeCandidateId'>;
export type OutcomeId = RuntimeBrand<string, 'OutcomeId'>;
export type CorrelationId = RuntimeBrand<string, 'CorrelationId'>;
export type CausationId = RuntimeBrand<string, 'CausationId'>;
export type IdempotencyKey = RuntimeBrand<string, 'IdempotencyKey'>;
export type RuntimeTurnId = RuntimeBrand<string, 'RuntimeTurnId'>;
export type RuntimeResponseId = RuntimeBrand<string, 'RuntimeResponseId'>;
export type GuidedActionId = RuntimeBrand<string, 'GuidedActionId'>;
export type JournalEntryId = RuntimeBrand<string, 'JournalEntryId'>;
export type RelationshipContextId = RuntimeBrand<string, 'RelationshipContextId'>;
export type TranscriptTurnId = RuntimeBrand<string, 'TranscriptTurnId'>;
export type TemplateId = RuntimeBrand<string, 'TemplateId'>;
export type SourceId = RuntimeBrand<string, 'SourceId'>;
