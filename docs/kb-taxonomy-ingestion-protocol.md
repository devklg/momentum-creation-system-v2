# Knowledge Base Taxonomy Ingestion Protocol

Status: active

This protocol governs MCS v2 approved Knowledge Base ingestion. Its purpose is
to make every new source usable by agents without Kevin having to hunt through
unclassified material.

## Mandatory Entry Point

All approved KB ingestion must use `createKevinApprovedKnowledgeSource()` in
`server/src/services/knowledge/approvedKnowledgeStore.ts`, either directly from
a script or through the admin Knowledge Base route.

Do not write KB sources, chunks, Chroma records, or Neo4j graph records by hand.
Do not create a second ingestion path.

Current approved callers:

- `server/src/routes/admin/knowledge.ts`
- `server/scripts/seed-three-knowledge-base.ts`
- `server/scripts/seed-three-blog-knowledge-base.ts`
- `server/scripts/seed-three-blog.ts`
- `server/scripts/seed-tm-training.ts`
- `server/scripts/seed-failla-knowledge-base.ts`
- `server/scripts/seed-upline-knowledge-base.ts`

## Required Taxonomy Contract

Every source and chunk must carry taxonomy version `kb_taxonomy.v1`.

Required source/chunk fields:

- `taxonomy`
- `categoryTags`
- `productTags`
- `canonicalTopicTags`
- `taxonomyUpdatedAt`

The canonical taxonomy implementation is
`server/src/services/knowledge/taxonomy.ts`.

Current top-level categories:

- `business-building`
- `compensation-plan`
- `compliance-policies`
- `forms-admin`
- `general-training`
- `product-science`
- `products`
- `team-training`
- `vision-strategy`
- `wellness-education`

Current product tags include:

- `glp-three`
- `visage`
- `kynetik`
- `collagene`
- `vitalite`
- `revive`
- `purifi`
- `imune`
- `eternel`
- `mbc-267`
- `omega-3`
- `coq10`
- `glutathione`

## Store Requirements

MongoDB:

- Source collection: `momentum.mcs_knowledge_sources`
- Chunk collection: `momentum.mcs_knowledge_chunks`
- Persist full taxonomy fields on both sources and chunks.

ChromaDB:

- Chunk collection: `mcs_knowledge_chunks`
- Persist taxonomy summary fields:
  - `taxonomyVersion`
  - `taxonomyPrimaryCategory`
  - `taxonomyCategoryTags`
  - `taxonomyProductTags`
  - `taxonomyTopicTags`
  - `taxonomyComplianceSensitivity`
- Persist boolean filter flags:
  - `kb.category.<slug>`
  - `kb.product.<slug>`
  - `kb.topic.<slug>`

Neo4j:

- Source node: `(:KnowledgeSource)`
- Chunk node: `(:KnowledgeChunk)`
- Category node: `(:KnowledgeCategory)`
- Product node: `(:KnowledgeProduct)`
- Topic node: `(:KnowledgeTopic)`
- Required relationships:
  - `(:KnowledgeSource)-[:IN_CATEGORY]->(:KnowledgeCategory)`
  - `(:KnowledgeSource)-[:ABOUT_PRODUCT]->(:KnowledgeProduct)`
  - `(:KnowledgeSource)-[:ABOUT_TOPIC]->(:KnowledgeTopic)`
  - `(:KnowledgeChunk)-[:IN_CATEGORY]->(:KnowledgeCategory)`
  - `(:KnowledgeChunk)-[:ABOUT_PRODUCT]->(:KnowledgeProduct)`
  - `(:KnowledgeChunk)-[:ABOUT_TOPIC]->(:KnowledgeTopic)`

## Human Index Requirement

The numbered index is `knowledge/KB_DOCUMENT_INDEX.md`.

It must be chronological, not category-sorted. The number is an arrival order
signal so Kevin can see what was added and when.

Required columns:

- Number
- Added At
- Category
- Corpus
- Domain
- Document / File
- Source Location
- Chunks
- SourceId

The ingestion path refreshes the index automatically. The manual refresh command
is:

```powershell
pnpm --filter @momentum/server kb:index
```

If the local pnpm approval guard blocks filtered scripts, run from
`D:/momentum-creation-system-v2/server`:

```powershell
npm run kb:index
```

## Backfill / Repair

When existing material predates this protocol, run:

```powershell
pnpm --filter @momentum/server kb:taxonomy:backfill
```

If the local pnpm approval guard blocks filtered scripts, run from
`D:/momentum-creation-system-v2/server`:

```powershell
npm run kb:taxonomy:backfill
```

Expected current corpus after the July 8, 2026 backfill:

- 208 sources
- 1,665 chunks
- 1,665 Chroma chunk metadata updates
- 10 top-level categories
- 13 product tags

## Verification

Verification command:

```powershell
pnpm --filter @momentum/server kb:verify
```

If the local pnpm approval guard blocks filtered scripts, run from
`D:/momentum-creation-system-v2/server`:

```powershell
npm run kb:verify
```

Register export:

```powershell
pnpm --filter @momentum/server kb:register
```

If the local pnpm approval guard blocks filtered scripts, run from
`D:/momentum-creation-system-v2/server`:

```powershell
npm run kb:register
```

Before running any DB-touching command from an inherited shell, clear stale
parent-process database env vars so the project `.env` wins:

```powershell
$env:ANTHROPIC_API_KEY=$null; $env:ANTHROPIC_AUTH_TOKEN=$null; $env:MONGODB_URI=$null; $env:MONGO_URI=$null; $env:NEO4J_URI=$null; $env:NEO4J_URL=$null; $env:CHROMA_URL=$null; $env:CHROMADB_URL=$null
```

Retrieval smoke test:

- `compensation plan binary financial rewards` should return financial rewards / compensation plan material.
- `GLP THREE metabolic support` should return GLP THREE product articles.
- `Visage skincare serum` should return Visage skincare material.
- `income claims compliance do and do not` should return governance / policy material.

## Agent Rule

Agents must use the Context Manager / approved knowledge provider for retrieval.
They must not browse raw folders, Mongo, Chroma, or Neo4j directly as a substitute
for the KB unless they are performing ingestion, repair, or verification.
