# Agent Brief: Knowledge Base, Context Manager, and VoiceBox Work

**Created:** 2026-07-04  
**Audience:** Codex, Claude, and future MCS v2 implementation agents  
**Purpose:** Preserve the current chat context so future agents know what Kevin asked for, what was built, what is still missing, and where to continue.

## Kevin's Intent

Kevin is building MCS v2 around a real-time Knowledge Base foundation that he controls. He is ultimately the source/provider of the Knowledge Base, and the app needs a practical upload flow where he can add different file types. The Knowledge Base must become the foundation for the Context Manager and agent layer, not just static docs in the repository.

Kevin also integrated VoiceBox during this session window and asked how VoiceBox can practically help agent voices inside MCS v2. The intended use is agent voices inside the MCS v2 app experience, not automated prospecting, not dialing, and not compliance-risk outreach.

Kevin also brought in a Dual RAG/context-engine article. The architectural direction is:

- Context engineering, not prompt-only reliability.
- A glass-box context engine with Planner, Executor, and Tracer.
- Dual RAG: factual Knowledge Base plus procedural Context Library.
- Agent communication through explicit protocol/schema contracts.
- Human-approved knowledge as the foundation.
- Runtime tracing so operators can see what context was retrieved and why.

## Important Compliance Boundary

VoiceBox and agent voice work are for BA/admin app support experiences only.

Do not use this work to implement:

- AI lead qualification.
- Automated prospecting.
- AI calling prospects.
- Prospect-facing AI language on `.com`.
- Income claims, placement promises, current team-count display, or THREE branding on prospect pages.

The relevant constitutional boundary remains: AI assists humans and never replaces human judgment or relationship.

## What Was Added

### VoiceBox Runtime Foundation

Files added/updated:

- `server/src/config/voiceboxRuntimeFlags.ts`
- `server/src/services/voicebox.ts`
- `server/src/services/__tests__/voicebox.test.ts`
- `server/src/runtime/browser/voiceboxRuntime.ts`
- `server/src/runtime/browser/__tests__/voiceboxRuntime.test.ts`
- `server/src/runtime/browser/index.ts`
- `server/src/runtime/index.ts`
- `.env.example`
- `server/src/env.ts`

Purpose:

- Define VoiceBox runtime config and feature flags.
- Provide a server-side VoiceBox service boundary.
- Add browser runtime contract support for voice/text runtime.
- Keep VoiceBox optional/degraded when not configured.

Operational notes:

- VoiceBox local MCP/TTS port shown by Kevin: `17493`.
- Kevin had VoiceBox showing connected bindings for `codex`, `codex-node-probe`, and `gateway`.
- Voice profiles are still a separate product/content concern; the app foundation is only the integration surface.

### Context Manager / Dual RAG Foundation

Files added/updated:

- `server/src/runtime/context/contextManagerService.ts`
- `server/src/runtime/context/__tests__/contextManagerService.test.ts`
- `server/src/runtime/context/index.ts`
- `server/src/runtime/index.ts`
- `server/src/runtime/context/michaelRuntimeContextFoundation.ts`
- `server/src/runtime/orchestration/michaelRuntimeTurnSource.ts`

Purpose:

- Establish a Planner / Executor / Tracer service shape.
- Accept a Knowledge Core boundary instead of letting agents browse raw knowledge.
- Allow Michael runtime context to use live approved knowledge when `MCS_CONTEXT_MANAGER_LIVE_ENABLED=true`.
- Preserve degraded/fail-closed behavior when the live context path is unavailable.

Important distinction:

- The Context Manager consumes approved knowledge references/chunks.
- Agents do not consume raw uploads directly.
- Raw source stays authoritative and traceable.

### Knowledge Authority Foundation

Files added/updated:

- `packages/shared/src/runtime/knowledge-intake.ts`
- `server/src/runtime/knowledge/intake/authority.ts`
- `server/src/runtime/knowledge/intake/pipeline.ts`
- `server/src/runtime/knowledge/intake/mapping.ts`
- `server/src/runtime/knowledge/intake/__tests__/knowledgeIntake.test.ts`

Authority model:

- `kevin_authored` and `kevin_approved` can become active authority.
- `agent_captured`, `system_captured`, and `third_party_reference` start as candidate-only.
- Candidate-only material is not retrieval-eligible until Kevin approval is represented.
- Legacy Kevin-created records can still be treated as active authority when the created-by marker is recognizable.

Core principle:

Kevin-approved knowledge is the app's authoritative base. Agent/system-captured knowledge is not active guidance by default.

### Canonical Knowledge Base Schema

File added:

- `packages/shared/src/runtime/knowledge-base-schema.ts`

Export added:

- `packages/shared/src/runtime/index.ts`

Schema version:

- `knowledge_base.schema.v1`

The schema contract now names:

- `McsKnowledgeBaseTextUploadRequest`
- `McsKnowledgeBaseFileUploadRequest`
- `McsKnowledgeBaseSourceRecord`
- `McsKnowledgeBaseChunkRecord`
- `McsKnowledgeBaseIndexProjection`
- `McsKnowledgeBaseAuthorityResolution`
- `MCS_KNOWLEDGE_BASE_PERSISTENCE_PROJECTION`

Persistence projection:

- Mongo source collection: `runtime_knowledge_sources`
- Mongo chunk collection: `runtime_knowledge_chunks`
- Neo4j source node: `KnowledgeSource`
- Neo4j chunk node: `KnowledgeChunk`
- Neo4j relationship: `HAS_CHUNK`
- Chroma collection pattern: `mcs_{domain}_knowledge_{language}`
- Chroma domain alias: `system` and `governance` map to `organizational`

Supported source/upload formats:

- `plain_text`
- `markdown`
- `csv`
- `json`
- `html`
- `pdf`
- `docx`

### Store-Backed Approved Knowledge

File added/moved:

- `server/src/services/knowledge/approvedKnowledgeStore.ts`

Important: this was moved into `services/knowledge/` because runtime boundary tests prohibit direct persistence calls inside `server/src/runtime`.

Purpose:

- Create Kevin-approved source records.
- Run deterministic intake/chunking.
- Triple-stack sources and chunks.
- Provide a stored approved knowledge provider for the Context Manager.

Runtime boundary:

- Runtime stays pure/inert.
- Persistence lives in service adapters.

### Knowledge File Extraction

Files added:

- `server/src/runtime/knowledge/knowledgeFileExtraction.ts`
- `server/src/runtime/knowledge/__tests__/knowledgeFileExtraction.test.ts`

Dependencies added:

- `mammoth`
- `pdf-parse`

Purpose:

- Extract text from supported upload files.
- Normalize text before the governed intake pipeline.
- Preserve original file kind in the Knowledge Base source record.

### Admin Knowledge Base API

File added:

- `server/src/routes/admin/knowledge.ts`

Mount added:

- `server/src/index.ts`

Endpoints:

- `POST /api/admin/knowledge/sources`
- `POST /api/admin/knowledge/sources/upload`

Important implementation note:

- The admin knowledge route is mounted with `express.json({ limit: '25mb' })` before the global `express.json({ limit: '256kb' })`, so base64 uploads do not fail because of the smaller global JSON limit.

Upload limits and behavior:

- Max upload bytes: 8 MB.
- Max extracted content: 50,000 characters.
- Max title length: 160.
- Upload accepts base64 JSON payload.
- The stored source gets upload metadata: filename, MIME type, byte count, extracted character count, and sourceRef.

### Admin Knowledge Base UI

Files added/updated:

- `apps/admin/src/routes/knowledge.tsx`
- `apps/admin/src/App.tsx`
- `apps/admin/src/components/admin-shell.tsx`

Purpose:

- Adds an admin Knowledge Base upload/paste page.
- Supports pasted text and file upload.
- Supports txt, md, csv/tsv, json, html, pdf, and docx.

## Current Domain Model

Knowledge domains currently available:

- `success`
- `training`
- `relationship`
- `performance`
- `organizational`
- `system`
- `governance`

Languages currently accepted:

- `en`
- `es`

Known agent scopes accepted by admin route:

- `steve_success`
- `michael_magnificent`
- `ivory`

Surface scopes for chunks:

- `team`
- `admin`

Do not add `.com` as a knowledge surface without explicit compliance review.

## Verification Already Run

Passing checks from this work:

- `pnpm --filter @momentum/shared build`
- `pnpm --filter @momentum/server typecheck`
- `pnpm --filter @momentum/admin typecheck`
- `pnpm typecheck`
- Targeted Vitest for:
  - approved knowledge store schema projection
  - file extraction
  - runtime boundary skeleton
  - knowledge intake
  - context manager
  - VoiceBox runtime/service

Known runtime blocker:

- Starting `pnpm dev:all` previously brought frontends up, but API port `7700` crashed because Neo4j rejected the configured password:
  - `Neo.ClientError.Security.Unauthorized`
- This is an environment/service credential issue, not a TypeScript issue.

## Open Questions For Kevin

Future agents should ask Kevin these before overfitting the Knowledge Base schema:

1. What files will be uploaded first: training PDFs, Word docs, scripts, policies, notes, spreadsheets, web pages, product info, or something else?
2. What subject buckets does Kevin want beyond the current domains?
3. Are files mostly Kevin-authored, Kevin-approved third-party/company material, or mixed?
4. Does Kevin need admin-only/private knowledge separate from BA-facing Michael knowledge?
5. Should Spanish be first-class from the start or staged after English?
6. Should spreadsheets become structured tables later instead of plain extracted text?
7. Should third-party/company material carry license/source/approval metadata beyond the current authority envelope?

## What Future Agents Should Not Do

Do not rebuild the Knowledge Base from scratch. The current foundation exists.

Do not put persistence back into `server/src/runtime`.

Do not let agents retrieve raw uploaded content directly.

Do not make candidate/system/agent-captured material active guidance without Kevin approval.

Do not expand VoiceBox into prospect-facing calls, prospect qualification, or automated outreach.

Do not treat Chroma as source of truth. Mongo source records are the canonical persisted source; Neo4j represents relationships; Chroma supports semantic recall.

## Likely Next Steps

Recommended continuation order:

1. Get Kevin's answer to the open Knowledge Base upload questions.
2. Add schema fields only if the first real upload set requires them.
3. Add Knowledge Base list/detail/manage screens in admin so Kevin can see what he uploaded.
4. Add source retirement/supersede flow.
5. Add readback verification for source/chunk persistence after upload.
6. Add live retrieval inspection in admin so Kevin can see what Michael would retrieve.
7. Resolve local Neo4j credential issue so the full dev server can run with triple-stack writes.

