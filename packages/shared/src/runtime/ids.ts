export type McsRuntimeBrand<TValue, TBrand extends string> = TValue & {
  readonly __runtimeBrand: TBrand;
};

export type McsTenantId = McsRuntimeBrand<string, 'TenantId'>;
export type McsTeamId = McsRuntimeBrand<string, 'TeamId'>;
export type TmagId = McsRuntimeBrand<string, 'TmagId'>;
export type McsAgentId = McsRuntimeBrand<string, 'AgentId'>;
export type McsRequestId = McsRuntimeBrand<string, 'RequestId'>;
export type McsSessionId = McsRuntimeBrand<string, 'SessionId'>;
export type McsRuntimeEventId = McsRuntimeBrand<string, 'RuntimeEventId'>;
export type McsContextPacketId = McsRuntimeBrand<string, 'ContextPacketId'>;
export type McsContextRequestId = McsRuntimeBrand<string, 'ContextRequestId'>;
export type McsKnowledgeId = McsRuntimeBrand<string, 'KnowledgeId'>;
export type McsKnowledgeCandidateId = McsRuntimeBrand<string, 'KnowledgeCandidateId'>;
export type McsOutcomeId = McsRuntimeBrand<string, 'OutcomeId'>;
export type McsCorrelationId = McsRuntimeBrand<string, 'CorrelationId'>;
export type McsCausationId = McsRuntimeBrand<string, 'CausationId'>;
export type McsIdempotencyKey = McsRuntimeBrand<string, 'IdempotencyKey'>;
export type McsRuntimeTurnId = McsRuntimeBrand<string, 'RuntimeTurnId'>;
export type McsRuntimeResponseId = McsRuntimeBrand<string, 'RuntimeResponseId'>;
export type McsGuidedActionId = McsRuntimeBrand<string, 'GuidedActionId'>;
export type McsJournalEntryId = McsRuntimeBrand<string, 'JournalEntryId'>;
export type McsRelationshipContextId = McsRuntimeBrand<string, 'RelationshipContextId'>;
export type McsTranscriptTurnId = McsRuntimeBrand<string, 'TranscriptTurnId'>;
export type McsTemplateId = McsRuntimeBrand<string, 'TemplateId'>;
export type McsSourceId = McsRuntimeBrand<string, 'SourceId'>;
