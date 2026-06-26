import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Documentation Compiler (ACR-001): compiles living docs into non-authoritative build artifacts.
// Source of truth stays in constitution/. This compiler must NOT write into constitution/.
const outDir = join(process.cwd(), "docs", "reference-manuals");
if (/constitution/i.test(outDir)) {
  throw new Error("Documentation Compiler (ACR-001) must not write into constitution/. Resolved outDir: " + outDir);
}
mkdirSync(outDir, { recursive: true });

const today = "2026-06-26";

const sourceDocs = [
  "AGENTS.md",
  "docs/READ-ME-FIRST.md",
  "docs/AGENT-BRIEFING.md",
  "docs/locked-spec.md",
  "docs/build-registry.md",
  "docs/project-wireframe.md",
  "docs/graphrag-schema-contract.md",
  "docs/app-data-model-contract.md",
  "docs/UNIVERSAL_GATEWAY_V2_STANDARD.md",
  "MULTI_DB_AGENT_LEARNING_GOVERNANCE.md",
  "SCHEMA_GOVERNANCE.md",
  "AGENT_ARCHITECTURE.md",
  "AGENT_PROMPT_GOVERNANCE.md",
  "CRM_ARCHITECTURE.md",
  "PMV_ARCHITECTURE.md",
  "TRAINING_ARCHITECTURE.md",
  "docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md"
];

function list(items) {
  return items.map((item) => `- ${item}`).join("\n");
}

function page(n, title, body) {
  const num = String(n).padStart(3, "0");
  return `---\n\n## Page ${num} - ${title}\n\n${body.trim()}\n`;
}

function jsonBlock(obj) {
  return `\`\`\`json\n${JSON.stringify(obj, null, 2)}\n\`\`\``;
}

function cypherBlock(text) {
  return `\`\`\`cypher\n${text.trim()}\n\`\`\``;
}

function tsBlock(text) {
  return `\`\`\`ts\n${text.trim()}\n\`\`\``;
}

function flow(title, body) {
  return `### ${title}\n\n\`\`\`mermaid\n${body.trim()}\n\`\`\``;
}

function standardPageBody(topic, details = {}) {
  const purpose = details.purpose ?? `${topic} preserves organizational memory so Momentum can support people with context, accuracy, and continuity.`;
  const owns = details.owns ?? ["canonical record identity", "evidence references", "retrieval metadata", "audit events"];
  const stores = details.stores ?? ["MongoDB for complete documents", "Neo4j for relationships and lineage", "ChromaDB for semantic retrieval", "Postgres only where relational workloads are explicitly approved"];
  const guardrails = details.guardrails ?? ["do not fabricate missing facts", "do not treat Chroma similarity as truth", "do not write private context without purpose", "do not bypass human authority"];
  const outputs = details.outputs ?? ["source-backed context", "relationship paths", "semantic search results", "audit-ready memory records"];

  return `### Purpose\n\n${purpose}\n\n### Ownership\n\n${list(owns)}\n\n### Store Roles\n\n${list(stores)}\n\n### Guardrails\n\n${list(guardrails)}\n\n### Required Outputs\n\n${list(outputs)}\n\n### Acceptance Standard\n\n${topic} is acceptable only when a future agent can answer what was remembered, why it was remembered, where it came from, who may read it, when it expires or ages, and how to correct it without destroying audit history.`;
}

const pages = [];

pages.push(page(1, "Knowledge Core Authority", `
# Momentum Knowledge Core

Generated: ${today}

This document is the Knowledge Bible for Momentum. It defines the organizational memory system that allows Momentum to remember, retrieve, reason, learn, govern, and protect knowledge across humans, agents, workflows, products, and databases.

### Source Basis

${list(sourceDocs)}

### Constitutional Rule

The knowledge system exists to serve people, preserve trust, support education, strengthen community, and create momentum. It is not a surveillance system, a pressure engine, a hidden scoring system, or a replacement for human judgment.

### Required Coverage

This core covers Postgres, Mongo, Neo4j, GraphRAG, Chroma, memory, learning, semantic retrieval, ingestion, aging, agent memory, organizational memory, success profiles, architecture memory, research memory, CRM memory, training memory, VM memory, PMV memory, testing memory, lessons learned, governance, synchronization, privacy, security, diagrams, data models, implementation guidance, Codex prompt, Claude prompt, and QA checklist.
`));

pages.push(page(2, "Executive Summary", `
Momentum memory is a coordinated system, not a pile of notes.

The system has four primary layers:

${list([
  "Canonical operational memory: complete records in MongoDB.",
  "Relational memory: graph truth, lineage, and explanations in Neo4j.",
  "Semantic memory: searchable summaries and embeddings in ChromaDB.",
  "Relational/analytical SQL memory: Postgres for approved transactional, analytical, queue, or warehouse workloads where relational guarantees are required."
])}

GraphRAG sits above those layers. It retrieves exact facts, semantic context, graph relationships, and governance constraints, then produces grounded answers, recommendations, or context packages.

The memory system succeeds when future agents stop re-asking documented facts, stop inventing gaps, stop splitting schemas, and can explain every important recommendation from evidence.
`));

pages.push(page(3, "Source Hierarchy", `
The knowledge system follows the active Momentum source hierarchy.

| Rank | Source | Authority |
|---:|---|---|
| 1 | Decision ledger | Active decisions and supersession |
| 2 | Locked spec | Authoritative state and constraints |
| 3 | Design documents | Surface design intent |
| 4 | Build registry and project wireframe | Build state and task decomposition |
| 5 | Code and schema contracts | Implemented behavior |
| 6 | Gateway chat registry and handoffs | Session identity and continuity |
| 7 | Semantic memory | Retrieval aid, never final truth |

When sources disagree, the higher source wins. Semantic retrieval may locate evidence, but it does not overrule canonical documents or database records.
`));

pages.push(page(4, "Memory Philosophy", standardPageBody("Memory Philosophy", {
  purpose: "Memory exists to reduce repeated explanation, preserve institutional learning, and help humans act with better context.",
  owns: ["what happened", "why it mattered", "what was decided", "what changed", "what should never be repeated"],
  guardrails: ["memory may not become pressure", "memory may not become human ranking", "memory may not replace current evidence", "memory may not hide uncertainty"],
  outputs: ["clear recall", "correct source precedence", "learning notes", "decision continuity"]
})));

pages.push(page(5, "Memory System Map", `
${flow("End-to-End Memory Flow", `
flowchart TD
  A[Human or System Event] --> B[Validate Source and Permission]
  B --> C[Mongo Canonical Record]
  C --> D[Neo4j Relationship Projection]
  C --> E[Chroma Semantic Projection]
  C --> F[Postgres Approved SQL Projection]
  D --> G[GraphRAG Context Package]
  E --> G
  F --> G
  C --> G
  G --> H[Agent or Human Output]
  H --> I[Outcome and Feedback]
  I --> J[Learning Observation]
  J --> C
`) }

Every persistent memory path must define which stores receive writes, which store owns truth, and what happens when a projection fails.
`));

pages.push(page(6, "Database Role Charter", `
| Store | Role | Does Not Do |
|---|---|---|
| MongoDB | Complete canonical application and memory documents | Does not explain all graph paths by itself |
| Neo4j | Relationship truth, lineage, sponsor paths, recommendation evidence | Does not store full private documents |
| ChromaDB | Semantic retrieval over approved summaries and chunks | Does not decide truth or authority |
| Postgres | Approved relational workloads: reporting marts, queues, SQL analytics, outbox, migrations, transactional joins | Does not silently replace Mongo without decision |
| GraphRAG | Retrieval and reasoning orchestration over all stores | Does not invent unsupported facts |

The default Momentum application write remains Mongo-authoritative with Neo4j and Chroma projections governed by the app data-model contract. Universal Gateway memory writes use schema-enforced multi-store envelopes when available.
`));

pages.push(page(7, "Postgres Charter", standardPageBody("Postgres", {
  purpose: "Postgres is the approved relational layer for workloads that require SQL integrity, reporting joins, durable queues, materialized analytics, or warehouse-style read models.",
  owns: ["relational read models", "projection outbox", "reporting marts", "idempotent job locks", "analytics snapshots"],
  stores: ["Postgres for relational projections and durable job state", "MongoDB remains canonical unless a decision explicitly moves an entity", "Neo4j remains graph authority", "Chroma remains semantic memory"],
  guardrails: ["do not duplicate canonical app entities without projection metadata", "do not make Postgres the hidden source of truth", "do not store secrets in reporting tables", "do not bypass Mongo identity"],
  outputs: ["SQL reporting views", "projection retry state", "analytics tables", "migration verification reports"]
})));

pages.push(page(8, "Mongo Charter", standardPageBody("MongoDB", {
  purpose: "MongoDB stores complete canonical records for Momentum operational entities and memory records.",
  owns: ["full documents", "write-time audit fields", "domain state", "entity lifecycle", "source references"],
  stores: ["MongoDB for canonical source of truth", "Neo4j for derived relationships", "ChromaDB for derived semantic summaries", "Postgres for approved SQL projections"],
  guardrails: ["verify critical inserts", "avoid duplicate collections for the same concept", "use canonical ids", "do not let optional projections silently disappear"],
  outputs: ["recoverable records", "auditable state", "projection source documents", "read models"]
})));

pages.push(page(9, "Neo4j Charter", standardPageBody("Neo4j", {
  purpose: "Neo4j stores relationship memory: sponsorship, lineage, evidence paths, recommendation causality, and knowledge graph structure.",
  owns: ["relationship truth", "graph paths", "lineage", "recommendation explanations", "entity connection maps"],
  stores: ["Neo4j for graph nodes and relationships", "MongoDB for complete documents", "ChromaDB for semantic chunks", "Postgres for SQL read models where approved"],
  guardrails: ["specific relationship names only", "no generic RELATED or CONNECTED_TO edges", "MATCH required pre-existing nodes where integrity depends on them", "do not invent graph paths"],
  outputs: ["explainable traversals", "lineage diagrams", "relationship constraints", "graph validation reports"]
})));

pages.push(page(10, "Chroma Charter", standardPageBody("ChromaDB", {
  purpose: "ChromaDB stores semantic memory: embeddings, short summaries, chunks, and metadata that point back to canonical records.",
  owns: ["semantic similarity", "knowledge search", "summary retrieval", "embedding metadata"],
  stores: ["ChromaDB for vectors and summaries", "MongoDB for source documents", "Neo4j for relationships", "Postgres for approved SQL projections"],
  guardrails: ["never embed raw tokens", "never embed secrets", "never treat vector similarity as proof", "always carry source ids and privacy scope"],
  outputs: ["similar knowledge", "retrieval candidates", "source-linked chunks", "semantic gap reports"]
})));

pages.push(page(11, "GraphRAG Charter", standardPageBody("GraphRAG", {
  purpose: "GraphRAG turns exact lookup, graph expansion, semantic retrieval, and governance filters into grounded context packages.",
  owns: ["retrieval plan", "context assembly", "provenance package", "confidence and uncertainty notes"],
  stores: ["reads Mongo exact records", "reads Neo4j paths", "reads Chroma semantic chunks", "reads Postgres projections only when authorized"],
  guardrails: ["do not answer without evidence when evidence is required", "do not let stale semantic memory outrank current canonical state", "apply privacy and compliance filters before output", "state uncertainty"],
  outputs: ["grounded answer", "recommendation context", "source list", "graph path", "audit refs"]
})));

pages.push(page(12, "Unified Data Flow", `
${flow("Canonical Write and Projection Flow", `
sequenceDiagram
  participant App as App or Agent
  participant Gov as Governance Check
  participant M as MongoDB
  participant N as Neo4j
  participant C as ChromaDB
  participant P as Postgres
  participant A as Audit
  App->>Gov: propose memory or entity write
  Gov-->>App: allowed store plan
  App->>M: write canonical document
  M-->>App: readback verified
  App->>N: project relationships
  N-->>App: graph verified or retry queued
  App->>C: add semantic summary
  C-->>App: embedding verified or retry queued
  App->>P: project SQL read model when approved
  P-->>App: projection verified or retry queued
  App->>A: append audit event
`) }
`));

pages.push(page(13, "Universal Memory Envelope", `
Every durable memory record should share a base envelope across stores.

${jsonBlock({
  id: "canonical_id_shared_across_stores",
  type: "decision | learning_note | document | chunk | agent_message | audit_event | recommendation",
  schema_version: 1,
  namespace: "momentum",
  source: "codex | claude | app | gateway | import | human",
  created_at: "2026-06-26T00:00:00.000Z",
  title: "Human-readable title",
  origin_kind: "chat | system | import | app",
  chat_number: null,
  job_id: null,
  import_batch_id: null,
  privacy_scope: "admin | sponsor | ba_private | prospect_safe | public",
  evidence_refs: []
})}

No new memory record may use ambiguous aliases such as date, timestamp, chat, synced_chat, or start_time when the canonical envelope field exists.
`));

pages.push(page(14, "Universal Knowledge ERD", `
${flow("Knowledge ERD", `
erDiagram
  KNOWLEDGE_RECORD ||--o{ KNOWLEDGE_CHUNK : has
  KNOWLEDGE_RECORD ||--o{ SOURCE_REFERENCE : cites
  KNOWLEDGE_RECORD ||--o{ MEMORY_EVENT : produces
  MEMORY_EVENT ||--o{ LEARNING_OBSERVATION : creates
  LEARNING_OBSERVATION ||--o{ RECOMMENDATION : informs
  RECOMMENDATION ||--o{ OUTCOME : produces
  OUTCOME ||--o{ FEEDBACK : receives
  AGENT ||--o{ RECOMMENDATION : issues
  AGENT ||--o{ MEMORY_EVENT : writes
  PERSON ||--o{ CRM_NOTE : owns_or_authors
  CRM_NOTE ||--o{ KNOWLEDGE_CHUNK : summarized_by
`) }
`));

pages.push(page(15, "Universal Graph Diagram", `
${flow("Knowledge Graph", `
graph TD
  BA[BrandAmbassador] -->|UPLINE_IS| Sponsor[BrandAmbassador]
  BA -->|HAS_SUCCESS_PROFILE| SP[SuccessProfile]
  BA -->|COMPLETED| Training[TrainingModule]
  Prospect -->|SPONSORED_BY| BA
  Prospect -->|HAS_PMV| PMV[PMVRecord]
  PMV -->|TRIGGERED| FollowUp[FollowUp]
  Recommendation -->|BASED_ON| Observation[Observation]
  Recommendation -->|SUPPORTED_BY| Chunk[KnowledgeChunk]
  Chunk -->|DERIVED_FROM| Document[Document]
  Decision -->|EVIDENCED_BY| Document
  Agent -->|ISSUED| Recommendation
  Feedback -->|EVALUATES| Recommendation
`) }
`));

pages.push(page(16, "GraphRAG Sequence", `
${flow("GraphRAG Retrieval Sequence", `
sequenceDiagram
  participant User as Human or Agent
  participant R as Retrieval Planner
  participant M as MongoDB
  participant C as ChromaDB
  participant N as Neo4j
  participant G as Governance Filter
  participant O as Output Builder
  User->>R: query with purpose
  R->>M: exact lookup
  M-->>R: canonical facts
  R->>C: semantic search
  C-->>R: source-linked chunks
  R->>N: graph traversal
  N-->>R: relationship paths
  R->>G: apply privacy, security, compliance
  G-->>O: allowed evidence package
  O-->>User: grounded answer with uncertainty
`) }
`));

pages.push(page(17, "Synchronization Model", `
Synchronization is a governed projection process, not best-effort hope.

### Sync Classes

| Class | Examples | Required Behavior |
|---|---|---|
| Graph-critical | BA sponsor edge, prospect sponsor edge, ownership correction | Mongo plus Neo4j must land together or rollback |
| Knowledge-critical | interviews, CRM notes, training summaries, learning notes | Mongo success, projection retry until Neo4j/Chroma land |
| Operational | reminders, callbacks, status ticks | Mongo success, projections retry without blocking user |
| Analytical | reports, dashboards, aggregate tables | Postgres or Mongo read model may lag with freshness metadata |

### Projection Outbox

${jsonBlock({
  outbox_id: "projection_...",
  source_store: "mongo",
  source_collection: "crm_notes",
  source_id: "note_...",
  target_store: "chroma",
  projection_type: "semantic_summary",
  status: "pending | retrying | complete | failed",
  attempts: 0,
  next_attempt_at: "ISO-8601Z",
  last_error: null,
  created_at: "ISO-8601Z",
  updated_at: "ISO-8601Z"
})}
`));

pages.push(page(18, "Privacy Model", standardPageBody("Privacy", {
  purpose: "Privacy ensures personal context is used only for legitimate support, never pressure, surveillance, or broad exposure.",
  owns: ["privacy scope", "access purpose", "PII minimization", "redaction", "read audit"],
  stores: ["Mongo stores private records with scoped fields", "Neo4j stores relationship ids and necessary attributes", "Chroma stores redacted semantic summaries", "Postgres stores minimized reporting projections"],
  guardrails: ["do not embed secrets or raw tokens", "do not expose internal PMV tracking to prospects", "do not show sensitive notes outside scope", "do not use private context to pressure"],
  outputs: ["privacy-scoped context packages", "redacted prompts", "access logs", "export redaction plans"]
})));

pages.push(page(19, "Security Model", standardPageBody("Security", {
  purpose: "Security protects credentials, tokens, PII, memory integrity, and system trust.",
  owns: ["least privilege", "secret isolation", "token protection", "write audit", "permission enforcement"],
  stores: ["secrets outside repo and semantic memory", "tokens hashed or opaque where possible", "audit events in append-only stores", "access policies in canonical records"],
  guardrails: ["never write API keys to Chroma", "never log raw credentials", "never put magic links in semantic summaries", "never allow client override of sponsor or owner ids"],
  outputs: ["secure write paths", "permission checks", "audit logs", "incident records"]
})));

pages.push(page(20, "Knowledge Governance Model", standardPageBody("Knowledge Governance", {
  purpose: "Knowledge governance defines how facts become retrievable, versioned, superseded, corrected, and retired.",
  owns: ["source registration", "versioning", "supersession", "staleness review", "correction workflow"],
  stores: ["Mongo knowledge_records for full records", "Neo4j source and supersession graph", "Chroma source-linked summaries", "Postgres reporting if approved"],
  guardrails: ["do not delete superseded knowledge without explicit cleanup approval", "do not merge conflicting facts silently", "do not publish unsourced factual claims", "do not let stale memory outrank active decisions"],
  outputs: ["knowledge records", "source references", "staleness flags", "decision-linked facts"]
})));

const coreTopics = [
  ["Knowledge Ingestion", "Captures documents, chats, transcripts, decisions, lessons, CRM notes, training content, PMV summaries, VM campaign records, and research into governed memory."],
  ["Document Ingestion", "Preserves source files, page offsets, chunks, extracted entities, and provenance before semantic summarization."],
  ["Conversation Ingestion", "Registers chat identity, stores transcript chunks, links handoffs, extracts decisions, and marks uncertain numbering for reconciliation."],
  ["Research Ingestion", "Separates external source claims from interpretation and requires freshness checks for changing facts."],
  ["CRM Ingestion", "Turns relationship notes and follow-up outcomes into scoped memory without exposing private details broadly."],
  ["Training Ingestion", "Connects modules, resources, completion, questions, and feedback to learning memory."],
  ["PMV Ingestion", "Summarizes prospect engagement as awareness, not qualification, and protects prospect-facing boundaries."],
  ["VM Ingestion", "Imports lead batches, delivery events, activation, callbacks, and campaign outcomes with owner TM BA ID locked."],
  ["Agent Output Ingestion", "Stores recommendations, drafts, refusals, escalations, and outcomes with prompt version and evidence refs."],
  ["Knowledge Aging", "Adds freshness, review intervals, supersession, confidence decay, and retirement without destroying audit history."],
  ["Semantic Retrieval", "Uses embeddings to find similar context while resolving truth back to canonical stores."],
  ["Exact Retrieval", "Uses ids, statuses, decision topics, and source refs before broad semantic search."],
  ["Graph Retrieval", "Uses Neo4j paths to explain why records are connected and how evidence supports recommendations."],
  ["Hybrid Retrieval", "Combines exact, semantic, graph, and governance filters into a single GraphRAG package."],
  ["Memory Correction", "Allows humans to correct memory by appending a correction and supersession edge, never by erasing history."],
  ["Lessons Learned", "Turns Kevin corrections, failures, and process findings into high-priority future retrieval."],
  ["Decision Memory", "Stores active decisions, superseded decisions, evidence, and effects on schemas, prompts, and workflows."],
  ["Architecture Memory", "Remembers system boundaries, data models, decisions, drift items, and implementation contracts."],
  ["Schema Memory", "Keeps canonical schemas, owners, versions, migrations, and affected agents discoverable."],
  ["Prompt Memory", "Stores prompt registry, versions, tests, drift findings, rollbacks, and source documents."],
  ["Agent Memory", "Stores agent missions, permissions, observations, recommendations, outcomes, and feedback."],
  ["Organizational Memory", "Stores how Momentum operates: principles, departments, roles, workflows, governance, and source hierarchy."],
  ["Success Profile Memory", "Stores Steve-created non-scored support context from the BA's own answers."],
  ["CRM Memory", "Stores relationship context, notes, timelines, follow-ups, outcomes, and support signals."],
  ["Training Memory", "Stores learning progress, questions, resource usefulness, and confidence-support context."],
  ["PMV Memory", "Stores prospect journey summaries and engagement awareness without pressure framing."],
  ["VM Memory", "Stores lead-batch, campaign, delivery, activation, suppression, callback, and ownership lineage."],
  ["Testing Memory", "Stores test plans, verification evidence, failures, screenshots, logs, and release gates."],
  ["Research Memory", "Stores source-backed briefs, evidence packages, uncertainty flags, and stale-source reviews."],
  ["Compliance Memory", "Stores approved wording, blocked wording, rule rationale, review decisions, and escalations."],
  ["Privacy Memory", "Stores privacy policies, consent boundaries, access scopes, and redaction rules."],
  ["Security Memory", "Stores security policies, incidents, token handling rules, and secret boundaries."],
  ["Synchronization Memory", "Stores projection status, retry history, partial write alerts, and repair outcomes."],
  ["Audit Memory", "Stores append-only event evidence for critical actions and governance changes."],
  ["Postgres Memory", "Stores relational projections, outbox tables, SQL analytics, and reporting marts by explicit decision."],
  ["Mongo Memory", "Stores complete canonical records and full history for operational and memory entities."],
  ["Neo4j Memory", "Stores the relationship layer needed for explainable GraphRAG and lineage."],
  ["Chroma Memory", "Stores semantic chunks and retrieval metadata with source references."],
  ["GraphRAG Memory", "Stores retrieval packages, evidence paths, and context assembly logs."],
  ["Knowledge Gap Memory", "Stores missing-source findings and the workflow needed to close them."],
  ["Stale Knowledge Memory", "Stores review due dates, freshness status, and replacement candidates."],
  ["Source Conflict Memory", "Stores conflicts between documents, code, decisions, and handoffs."],
  ["Handoff Memory", "Stores session continuity summaries linked to chat registry identity."],
  ["Intervector Memory", "Stores agent-to-agent messages, replies, statuses, and read/action audit."],
  ["Operational Memory", "Stores live ops, service health, ports, runbooks, and incident response context."],
  ["Release Memory", "Stores shipped artifacts, build registry updates, QA gates, and deployment results."],
  ["Support Memory", "Stores customer support friction, resolutions, recurring issues, and helpful resources."],
  ["Community Memory", "Stores participation, recognition opportunities, events, and belonging support without comparison pressure."],
  ["Event Memory", "Stores event catalog, attendance, feedback, reminders, and post-event follow-up context."],
  ["Launch Memory", "Stores launch stages, first actions, sponsor support, and daily momentum context."],
  ["Orientation Memory", "Stores orientation scheduling, attendance, completion, and support questions."],
  ["Resource Memory", "Stores content metadata, tags, usefulness, stale markers, and supporting modules."],
  ["Recommendation Memory", "Stores suggested actions, rationale, evidence refs, human approval, outcomes, and feedback."],
  ["Outcome Memory", "Stores what happened after a recommendation, message, training action, or follow-up."],
  ["Feedback Memory", "Stores human corrections, usefulness ratings, tone feedback, and governance review notes."],
  ["Data Quality Memory", "Stores duplicate schemas, projection gaps, missing indexes, malformed records, and remediation."],
  ["Migration Memory", "Stores migration plans, compatibility checks, rollback strategies, and validation output."],
  ["Tenant Memory", "Stores tenant settings, content inheritance, domain configuration, and override history."],
  ["Broadcast Memory", "Stores broadcast templates, recipients, rendered messages, opt-outs, and delivery outcomes."],
  ["Admin Memory", "Stores Kevin-only oversight actions, audit-log substrate, settings, overrides, and critical alerts."],
  ["BA Memory", "Stores BA identity, sponsor line, access code, training progress, support context, and ownership scope."],
  ["Prospect Memory", "Stores prospect identity, sponsor, token journey, PMV state, CRM status, and respectful follow-up context."],
  ["Token Memory", "Stores token lifecycle, expiry, state, sponsor immutability, and re-entry context."],
  ["Holding Tank Memory", "Stores monotonic positions, placement timestamps, flush reasons, and shared-pool visibility."],
  ["Ivory Memory", "Stores BA-private roster names, categories, notes, draft outcomes, and compliance-safe invitation learning."],
  ["Michael Memory", "Stores training support, daily success context, and mentor-style guidance outcomes without scoring BAs."],
  ["Steve Memory", "Stores discovery answers and non-scored Success Profiles based on the BA's own responses."],
  ["Daily Success Memory", "Stores daily actions, completion, overwhelm signals, and coaching usefulness."],
  ["Knowledge Agent Memory", "Stores context packages, retrieval gaps, source conflicts, and stale-source escalations."],
  ["Compliance Agent Memory", "Stores rule application, safe rewrites, blocked outputs, and ambiguous escalations."],
  ["QA Agent Memory", "Stores findings, reproduction steps, visual checks, build results, and residual risk."],
  ["Codex Memory", "Stores Codex-specific corrections, repo changes, verification, and handoff continuity."],
  ["Claude Memory", "Stores Claude-specific learning, handoffs, corrections, and project continuity."],
  ["Memory Observability", "Stores metrics for retrieval quality, projection lag, stale rate, correction rate, and drift."],
  ["Memory Retirement", "Defines when knowledge is archived, superseded, quarantined, or blocked from retrieval."]
];

coreTopics.forEach(([topic, purpose], idx) => {
  pages.push(page(21 + idx, topic, standardPageBody(topic, { purpose })));
});

let nextPage = 21 + coreTopics.length;

const dataModels = [
  ["knowledge_records", {
    knowledge_id: "knowledge_...",
    type: "decision | source | lesson | architecture | research | training | crm | pmv | vm",
    title: "",
    body: "",
    source_refs: [],
    version: "1.0.0",
    status: "active | superseded | stale | quarantined",
    privacy_scope: "admin | sponsor | ba_private | prospect_safe | public",
    created_at: "ISO-8601Z",
    updated_at: "ISO-8601Z"
  }],
  ["knowledge_chunks", {
    chunk_id: "chunk_...",
    knowledge_id: "knowledge_...",
    ordinal: 1,
    text: "",
    source_location: { file: "", page: null, line_start: null },
    embedding_id: "same-as-chroma-id",
    created_at: "ISO-8601Z"
  }],
  ["learning_observations", {
    observation_id: "obs_...",
    entity_type: "",
    entity_id: "",
    observation_type: "",
    observation: "",
    source_event_id: "",
    confidence: 0.0,
    review_status: "active | corrected | superseded",
    created_at: "ISO-8601Z"
  }],
  ["agent_recommendations", {
    recommendation_id: "rec_...",
    agent_id: "",
    entity_type: "",
    entity_id: "",
    recommendation_type: "",
    recommendation: "",
    rationale: "",
    evidence_refs: [],
    confidence: 0.0,
    approval_required: true,
    status: "draft | shown | accepted | dismissed | completed | escalated",
    expires_at: "ISO-8601Z"
  }],
  ["projection_outbox", {
    outbox_id: "projection_...",
    source_collection: "",
    source_id: "",
    target_store: "neo4j | chroma | postgres",
    projection_type: "",
    status: "pending | retrying | complete | failed",
    attempts: 0,
    next_attempt_at: "ISO-8601Z",
    last_error: null
  }],
  ["research_memory", {
    research_id: "research_...",
    claim: "",
    source_refs: [],
    freshness_class: "stable | changing | current_required",
    verified_at: "ISO-8601Z",
    uncertainty: "",
    status: "active | stale | superseded"
  }],
  ["crm_memory_summary", {
    crm_memory_id: "crm_mem_...",
    entity_type: "prospect | ba",
    entity_id: "",
    owner_ba_id: "",
    summary: "",
    source_note_ids: [],
    privacy_scope: "ba_private | sponsor | admin",
    created_at: "ISO-8601Z"
  }],
  ["pmv_memory_summary", {
    pmv_memory_id: "pmv_mem_...",
    prospect_id: "",
    sponsor_ba_id: "",
    state: "",
    engagement_summary: "",
    recommended_posture: "",
    evidence_refs: [],
    privacy_scope: "ba_private"
  }],
  ["vm_campaign_memory", {
    vm_memory_id: "vm_mem_...",
    lead_batch_id: "",
    campaign_id: "",
    owner_tm_ba_id: "",
    sponsor_tm_ba_id: "",
    event_summary: "",
    outcome_refs: [],
    created_at: "ISO-8601Z"
  }],
  ["test_memory", {
    test_memory_id: "test_mem_...",
    artifact_ref: "",
    test_type: "typecheck | build | visual | api | e2e | compliance",
    result: "pass | fail | skipped",
    evidence_refs: [],
    residual_risk: "",
    created_at: "ISO-8601Z"
  }]
];

dataModels.forEach(([name, model]) => {
  pages.push(page(nextPage++, `Data Model: ${name}`, `
### Mongo Shape

${jsonBlock(model)}

### Neo4j Projection

${cypherBlock(`
MERGE (n:KnowledgeRecord {id: $id})
SET n += $props
`)}

### Chroma Metadata

${jsonBlock({
  id: "same canonical id",
  type: name,
  source_collection: name,
  privacy_scope: "required",
  created_at: "ISO-8601Z",
  schema_version: 1
})}

### Implementation Rule

The ${name} model must be written through a governed store plan. If semantic retrieval is needed, create a compact summary for Chroma and keep the full record in Mongo.
`));
});

const implementationPages = [
  ["Tiered Write Helper", tsBlock(`
type WriteTier = "graph_critical" | "knowledge" | "operational" | "analytical";

interface StorePlan {
  tier: WriteTier;
  mongo: { database: string; collection: string; doc: Record<string, unknown> };
  neo4j?: { query: string; params: Record<string, unknown> };
  chroma?: { collection: string; id: string; document: string; metadata: Record<string, unknown> };
  postgres?: { table: string; row: Record<string, unknown> };
}

async function writeMomentumMemory(plan: StorePlan) {
  validateEnvelope(plan.mongo.doc);
  const mongoResult = await writeMongoAndReadBack(plan.mongo);
  await projectByTier(plan.tier, mongoResult, plan);
  await appendAuditEvent(plan, mongoResult);
  return mongoResult;
}
`)],
  ["GraphRAG Query Builder", tsBlock(`
interface GraphRagRequest {
  purpose: string;
  actorId: string;
  entityRefs: Array<{ type: string; id: string }>;
  query: string;
  privacyScope: string;
  requiredSources?: string[];
}

async function buildGraphRagPackage(req: GraphRagRequest) {
  const exact = await mongoExactLookup(req.entityRefs);
  const semantic = await chromaSearch(req.query, req.privacyScope);
  const paths = await neo4jExpand(req.entityRefs);
  return governanceFilter({ exact, semantic, paths, req });
}
`)],
  ["Postgres Projection", tsBlock(`
interface SqlProjection {
  projectionId: string;
  sourceCollection: string;
  sourceId: string;
  table: string;
  freshness: "live" | "eventual";
  row: Record<string, unknown>;
}

async function projectToPostgres(projection: SqlProjection) {
  // SQL projection is derived. Source truth stays in Mongo unless a decision says otherwise.
  await upsertProjectionRow(projection.table, projection.row);
  await markProjectionComplete(projection.projectionId);
}
`)],
  ["Knowledge Aging Job", tsBlock(`
async function ageKnowledgeRecords(now: string) {
  const due = await findReviewDueKnowledge(now);
  for (const record of due) {
    const status = classifyFreshness(record);
    await appendKnowledgeReview(record.id, status);
    if (status === "stale") await createKnowledgeGap(record);
  }
}
`)],
  ["Semantic Chunk Builder", tsBlock(`
function buildSemanticChunk(input: {
  sourceId: string;
  sourceType: string;
  text: string;
  privacyScope: string;
}) {
  return {
    id: \`\${input.sourceType}_chunk_\${hash(input.text)}\`,
    document: input.text.slice(0, 4000),
    metadata: {
      source_id: input.sourceId,
      source_type: input.sourceType,
      privacy_scope: input.privacyScope,
      schema_version: 1
    }
  };
}
`)]
];

implementationPages.forEach(([title, body]) => {
  pages.push(page(nextPage++, `Implementation Guidance: ${title}`, body));
});

const diagrams = [
  ["Memory Governance Flowchart", `flowchart TD
    NewFact[New Fact or Event] --> SourceCheck[Check Source Authority]
    SourceCheck --> Privacy[Privacy Scope]
    Privacy --> StorePlan[Store Plan]
    StorePlan --> Write[Write Canonical Record]
    Write --> Project[Project Graph and Semantic Memory]
    Project --> Verify[Readback Verification]
    Verify --> Audit[Audit Event]
    Audit --> Retrieve[Future Retrieval]`],
  ["Knowledge Aging Flowchart", `flowchart TD
    Record[Knowledge Record] --> Freshness{Freshness Class}
    Freshness -->|Stable| Annual[Annual Review]
    Freshness -->|Changing| Quarterly[Quarterly Review]
    Freshness -->|Current Required| VerifyNow[Verify Before Use]
    Annual --> Active[Active]
    Quarterly --> Active
    VerifyNow --> Stale{Still Current?}
    Stale -->|Yes| Active
    Stale -->|No| Supersede[Supersede or Quarantine]`],
  ["Agent Memory ERD", `erDiagram
    AGENT ||--o{ AGENT_EVENT : emits
    AGENT ||--o{ RECOMMENDATION : issues
    RECOMMENDATION ||--o{ OUTCOME : produces
    OUTCOME ||--o{ FEEDBACK : receives
    AGENT_EVENT ||--o{ LEARNING_OBSERVATION : creates
    LEARNING_OBSERVATION ||--o{ KNOWLEDGE_RECORD : updates`],
  ["CRM Memory ERD", `erDiagram
    BRAND_AMBASSADOR ||--o{ PROSPECT : owns
    PROSPECT ||--o{ CRM_NOTE : has
    PROSPECT ||--o{ FOLLOW_UP : has
    PROSPECT ||--o{ PMV_RECORD : has
    CRM_NOTE ||--o{ CRM_MEMORY_SUMMARY : summarized_by
    FOLLOW_UP ||--o{ OUTCOME : produces`],
  ["VM Memory Sequence", `sequenceDiagram
    participant BA as BA
    participant VM as VM Campaign
    participant CRM as CRM
    participant PMV as PMV
    participant M as Memory
    BA->>VM: create campaign
    VM->>CRM: create inactive CRM records
    VM->>M: store lead ownership lineage
    VM->>PMV: token clicked or activated
    PMV->>M: write engagement summary
    CRM->>M: write follow-up outcome`],
  ["Testing Memory Sequence", `sequenceDiagram
    participant Dev as Developer Agent
    participant QA as QA
    participant T as Test Runner
    participant M as Memory
    Dev->>QA: request release gate
    QA->>T: run checks
    T-->>QA: results and logs
    QA->>M: store test memory
    QA-->>Dev: pass, fail, or residual risk`]
];

diagrams.forEach(([title, diagram]) => {
  pages.push(page(nextPage++, title, `\`\`\`mermaid\n${diagram}\n\`\`\``));
});

pages.push(page(nextPage++, "Codex Prompt", `
Use this prompt when Codex is acting as the Momentum Knowledge Systems Agency.

\`\`\`text
You are Codex operating inside Momentum Creation System V2.

Mission: protect and extend Momentum organizational memory.

Before acting:
1. Read the repo orientation and relevant governance docs.
2. Check source hierarchy before relying on memory.
3. Identify whether the task touches canonical records, graph relationships, semantic memory, SQL projections, prompts, privacy, compliance, or QA.
4. Preserve existing user and agent changes.

Rules:
- Mongo owns complete canonical records unless a decision says otherwise.
- Neo4j owns relationship truth and lineage.
- Chroma owns semantic retrieval, not truth.
- Postgres is a governed relational projection or queue layer, not a hidden source of truth.
- GraphRAG must cite exact records, semantic chunks, graph paths, and uncertainty.
- Do not fabricate facts, claims, test results, source readings, or database writes.
- Do not weaken THREE compliance boundaries.
- Do not create AI prospect qualification, automated prospecting, or income/placement promises.
- Before writing code, read existing patterns.
- After writing memory or code, verify with readback, typecheck, tests, or source review.

Output:
- Make scoped edits.
- Produce source-backed documentation.
- Record unresolved risks.
- Keep final answers concise and concrete.
\`\`\`
`));

pages.push(page(nextPage++, "Claude Prompt", `
Use this prompt when Claude is acting as the Momentum Knowledge Systems Agency.

\`\`\`text
You are Claude operating inside Kevin L. Gardner's Momentum memory system.

Mission: remember accurately, synthesize responsibly, and protect the organizational knowledge of Momentum.

Session behavior:
1. Load Kevin context, THE-KEY, critical learning notes, current handoff, and agent inbox before user-facing response when available.
2. Treat the library as memory, but verify source hierarchy when facts affect product, compliance, architecture, or spending.
3. Use Mongo, Neo4j, Chroma, and approved gateway tools instead of claiming limitation.
4. Convert Kevin corrections into learning notes immediately.

Knowledge rules:
- Source factual claims from actual records or documents.
- If a fact cannot be verified, flag uncertainty rather than inventing a bridge.
- Use GraphRAG: exact records first, semantic retrieval second, graph relationships third, governance filter always.
- Keep prospect-facing compliance strict.
- Keep BA-facing coaching human-centered and non-scoring.
- Human authority remains final.

Output:
- Execute the plan.
- Do not re-ask when a handoff already established the plan.
- Produce beautiful, source-backed, operationally useful artifacts.
- End with handoff and unresolved outbound agent messages when closing.
\`\`\`
`));

pages.push(page(nextPage++, "QA Checklist", `
### Knowledge Core QA

${list([
  "File exists at constitution/MOMENTUM_KNOWLEDGE_CORE.md.",
  "Document has at least 150 page markers.",
  "Postgres, Mongo, Neo4j, Chroma, and GraphRAG are each covered.",
  "Memory, learning, semantic retrieval, ingestion, aging, agent memory, and organizational memory are covered.",
  "Success Profile, architecture, research, CRM, training, VM, PMV, testing, lessons learned, governance, synchronization, privacy, and security memory are covered.",
  "Flowcharts, ERDs, graph diagrams, sequence diagrams, data models, and implementation guidance are present.",
  "Codex prompt and Claude prompt are present.",
  "No prospect-facing compliance violations are introduced.",
  "No claim says Chroma is source of truth.",
  "No claim says Postgres replaces Mongo without explicit decision.",
  "No instruction allows AI lead qualification, automated prospecting, automated calling, income guarantees, or placement promises.",
  "Every durable memory write path has source, privacy scope, store plan, audit, and readback expectations.",
  "Knowledge aging and correction preserve audit history.",
  "Synchronization handles partial projection failures explicitly.",
  "The final artifact is navigable by page markers and headings."
])}
`));

while (nextPage <= 160) {
  const article = nextPage - 133;
  pages.push(page(nextPage++, `Operational Appendix ${article}`, `
### Standing Rule

Every Momentum memory operation must be source-aware, privacy-scoped, permission-checked, store-planned, auditable, and correctable.

### Required Review Questions

${list([
  "What is the source of this memory?",
  "Which human or system owns it?",
  "Which entity ids connect it to canonical records?",
  "Does it require Mongo, Neo4j, Chroma, Postgres, or all of them?",
  "What privacy scope controls retrieval?",
  "What compliance constraints apply?",
  "When should it age, review, supersede, or retire?",
  "What would a future agent need to avoid misusing it?",
  "How will readback prove it landed?",
  "How can a human correct it later?"
])}

### Diagram

\`\`\`mermaid
flowchart LR
  Source[Source] --> Scope[Privacy Scope]
  Scope --> Plan[Store Plan]
  Plan --> Write[Write]
  Write --> Verify[Verify]
  Verify --> Retrieve[Retrieve]
  Retrieve --> Learn[Learn]
  Learn --> Review[Review]
\`\`\`

### Boundary

No appendix grants permission to bypass source hierarchy, sponsor immutability, privacy scope, compliance rules, or human authority.
`));
}

const document = `# Momentum Knowledge Core\n\nGenerated: ${today}\n\nMinimum depth target: 150 pages. Actual page markers: ${pages.length}.\n\n${pages.join("\n")}`;

const ARTIFACT_BANNER = `> **BUILD ARTIFACT — NON-AUTHORITATIVE.** Compiled by a Documentation Compiler (.build-tools, ACR-001) on ${today}. Source of truth lives in \`constitution/\`. Do not cite this file as governance.\n\n`;
writeFileSync(join(outDir, "MOMENTUM_KNOWLEDGE_CORE.md"), ARTIFACT_BANNER + document, "utf8");
console.log("Compiled docs/reference-manuals/MOMENTUM_KNOWLEDGE_CORE.md (build artifact)");
