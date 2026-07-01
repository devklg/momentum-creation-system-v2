# ACR-0009 — Cloud Approved-Knowledge Retrieval with Local Embedding Authority

## Momentum Creation System V2

Status: Approved

Priority: Deployment §8 / Knowledge Runtime Activation — required before production BA support agents use cloud retrieval

Type: Deployment Topology + Knowledge Retrieval + Embedding Profile + External Managed Service

Risk: High (knowledge boundary, production retrieval behavior, external vector service, and query-time agent context)

Approval: APPROVED by Kevin L. Gardner — 2026-07-01

Register note: Recorded in the active register (`organization/ACR-REGISTER.md`). This ACR extends ACR-0007 and ACR-0008; it does not override either.

---

## Purpose

Establish the production architecture for real-time Brand Ambassador knowledge answers when BAs access the application from around the country.

The selected topology keeps the full private/master knowledge base local, embeds and curates knowledge locally, publishes only an approved BA-facing knowledge mirror to Chroma Cloud, and embeds production queries in real time using the same versioned embedding profile.

This record also locks the correction that the Universal Gateway is an MCP/developer tool and is not part of the production app request path.

---

## Trigger (MOMENTUM_ACR_SYSTEM §1)

This change touches multiple mandatory ACR triggers:

- an external managed service is added to production retrieval: Chroma Cloud;
- a production knowledge-retrieval topology is selected;
- an embedding profile becomes a compatibility contract between local ingestion and production query-time retrieval;
- a scheduled local-to-cloud publication path is introduced;
- the Context Manager gains a production approved-knowledge retrieval dependency.

Under §7, this is High risk because it changes production agent context and the knowledge activation boundary.

---

## Context

Kevin's requirements:

- The full/private/master knowledge base stays local.
- Knowledge intake, curation, and document embedding happen locally.
- New BAs across the country need real-time answers.
- Local publishing can run every 12 hours.
- Production still needs to embed each live query before requesting vector search.
- InterServer is the intended hosting provider.
- The Gateway is not the persistence edge; it is an MCP server tool used by agents and developers.

Current local embedding service:

- Path: `D:/agents/doc-parser/gpu-embeddings-service/embedding_service.py`
- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Device: CUDA on local GPU
- Dimension: 384
- Current behavior: no explicit `normalize_embeddings=True`

Research reviewed 2026-07-01:

- Chroma Cloud Starter is `$0/month + usage` with free credits; Team is `$250/month + usage`.
- Chroma Cloud charges by logical GiB written, storage, queried TiB, and returned network volume.
- Chroma Cloud is a managed/serverless Chroma service with the same core API shape as open-source Chroma.
- Chroma Cloud stores and searches vectors; this architecture does not rely on Chroma Cloud to generate embeddings.
- `sentence-transformers/all-MiniLM-L6-v2` maps text to a 384-dimensional dense vector space for semantic search.

Sources:

- `https://www.trychroma.com/pricing`
- `https://docs.trychroma.com/cloud/pricing`
- `https://docs.trychroma.com/cloud/getting-started`
- `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2`

---

## Decision

Adopt a hybrid knowledge topology:

```text
Local master knowledge base
  -> local curation and approval
  -> local GPU embedding with versioned normalized profile
  -> 12-hour publication of approved BA-facing chunks
  -> Chroma Cloud approved-knowledge mirror
  -> production app embeds live query
  -> production app queries Chroma Cloud
  -> Context Manager injects approved knowledge into agent context
```

### Selected option

**Local authority + cloud approved mirror + production query embedder.**

The local system remains the authority for the full knowledge base and the approval process. Chroma Cloud becomes a hosted retrieval mirror for approved BA-facing knowledge only. The production app performs query embedding through a small query-embedder service deployed with, or next to, the app on InterServer.

### Rejected options

**VPS reaches local knowledge base.** Rejected. It creates fragile home-network dependency, uptime risk, firewall exposure, and unacceptable production latency/failure coupling.

**Full production cloud knowledge base.** Rejected for now. It puts the full/master knowledge base into cloud scope before the curation, privacy, and publication boundaries are ready.

**Hosted embeddings as primary embedding authority.** Rejected for now. It introduces model drift and provider cost/availability dependency. The system already has a local GPU embedding authority, and consistency matters more than convenience.

---

## Embedding Contract

The approved production knowledge mirror must use a versioned profile:

```text
embedding_profile: all-MiniLM-L6-v2-384-normalized-v1
model: sentence-transformers/all-MiniLM-L6-v2
dimensions: 384
normalized: true
```

Both document chunks and live queries must use this same profile.

The local GPU embedding service must be updated to support and report:

```json
{
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "dimensions": 384,
  "normalized": true,
  "profile": "all-MiniLM-L6-v2-384-normalized-v1"
}
```

The application must reject retrieval if the query embedder returns the wrong dimension, wrong model/profile, or wrong normalization state.

### Collection migration rule

Do not mix normalized and unnormalized vectors in one collection.

The cloud mirror must be created as a new collection, for example:

```text
mcs_ba_knowledge_norm_v1
```

Existing local unnormalized collections may remain available for local-only workflows until intentionally rebuilt. They are not the production BA support mirror.

---

## Production Runtime Path

The production app request path is:

```text
BA question
  -> authenticated app route / agent runtime
  -> Context Manager approved-knowledge retrieval
  -> query embedder service
  -> Chroma Cloud collection query
  -> approved chunks returned
  -> agent response generated with approved context
```

The Gateway is not in this path.

The app runtime must use direct service clients/adapters, consistent with ACR-0007.

---

## Publication Path

Every 12 hours, local infrastructure publishes approved BA-facing knowledge:

```text
local source / master knowledge
  -> approved active knowledge selection
  -> chunking
  -> local normalized embedding
  -> cloud upsert into mcs_ba_knowledge_norm_v1
  -> publish manifest and verification report
```

Publication must include metadata sufficient for audit and rollback:

```json
{
  "knowledge_status": "approved",
  "audience": "ba",
  "embedding_profile": "all-MiniLM-L6-v2-384-normalized-v1",
  "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
  "embedding_dimensions": 384,
  "embedding_normalized": true,
  "source_authority": "local_master_knowledge",
  "published_at": "ISO-8601",
  "source_id": "..."
}
```

The publication job must not publish private/master-only content.

---

## Application Changes Authorized by Approval

On approval, implementation may add:

- environment variables for Chroma Cloud URL/API key/database/collection;
- environment variables for the query embedder URL and embedding profile;
- app-side embedding profile validation;
- an approved-knowledge retrieval service under the runtime knowledge boundary;
- Context Manager integration for approved knowledge packets;
- a local/cloud publication job and manifest;
- health checks for Chroma Cloud and the query embedder.

Expected files or areas:

- `server/src/env.ts`
- `server/src/services/persistence/chroma/embedder.ts`
- `server/src/services/persistence/chroma/connection.ts`
- `server/src/runtime/knowledge/knowledgeCore.ts`
- `server/src/runtime/context/contextManager.ts`
- `.env.example`
- local service: `D:/agents/doc-parser/gpu-embeddings-service/embedding_service.py`

This ACR does not authorize direct agent access to Chroma Cloud. Agents consume retrieved knowledge only through the Context Manager / Knowledge Core boundary.

---

## Operational Defaults

Recommended production defaults:

```env
BA_KNOWLEDGE_COLLECTION=mcs_ba_knowledge_norm_v1
EMBEDDING_PROFILE=all-MiniLM-L6-v2-384-normalized-v1
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
EMBEDDING_DIMENSIONS=384
EMBEDDING_NORMALIZE=true
QUERY_EMBEDDER_URL=http://127.0.0.1:8300
KNOWLEDGE_PUBLISH_CADENCE_HOURS=12
```

Chroma Cloud credentials must be stored as deployment secrets and never committed.

---

## Impact

- **Knowledge boundary:** full/private knowledge remains local; only approved BA-facing knowledge is mirrored to cloud.
- **Runtime retrieval:** production retrieval becomes cloud-accessible and real time.
- **Embedding compatibility:** normalized 384-dimensional vectors become a hard contract for this mirror.
- **Cost posture:** starts on Chroma Cloud Starter if usage allows; Team plan is a later operational decision if production support/SOC II/team limits require it.
- **Gateway role:** unchanged from ACR-0007 — MCP/developer tooling only, not production runtime.

---

## Gates (MOMENTUM_ACR_SYSTEM §5)

- **Review:** Architecture review verifies privacy boundary, Context Manager boundary, Gateway boundary, and embedding compatibility.
- **Approval:** Kevin (High risk).
- **Implementation:** create the query embedder contract, cloud collection, publication path, and Context Manager retrieval path.
- **Testing:** `pnpm typecheck`; local embedder health; production query embedder health; cloud collection write/read/query; metadata filter; retrieval packet contract; no private/master-only content in the mirror.
- **Verification:** sample BA questions return relevant approved chunks; stale publish manifest is detected; embedder mismatch fails closed.
- **Merge:** Kevin merges; agents do not.
- **Release:** launch with usage/billing monitoring enabled.

---

## Versioning and Rollback (§6)

- Target Version: v1.2 unless Kevin schedules it into the current deployment work.
- `rollback_to`: disable cloud approved-knowledge retrieval and fall back to no active retrieval / manual approved context. Do not fall back to unapproved or private local knowledge.
- Collection versioning: future embedding changes require a new collection suffix and new profile, for example `mcs_ba_knowledge_norm_v2`.

---

## Structured Record (MOMENTUM_ACR_SYSTEM §3)

```json
{
  "acr_id": "ACR-0009",
  "title": "Cloud approved-knowledge retrieval with local embedding authority",
  "status": "approved",
  "risk_level": "high",
  "change_type": "deployment-topology+knowledge-retrieval+embedding-profile+external-managed-service",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "knowledge-boundary",
      "context-manager-boundary",
      "external-service:chroma-cloud",
      "embedding-profile",
      "gateway-boundary",
      "privacy-boundary"
    ]
  },
  "affected": {
    "documents": [
      "organization/ACR-0007-runtime-persistence-direct-not-gateway.md",
      "organization/ACR-0008-knowledge-library-intake.md",
      "runtime/KNOWLEDGE_CORE_RUNTIME.md",
      "runtime/KNOWLEDGE_INGESTION_PROTOCOL.md",
      "docs/DEPLOYMENT_GUIDE.md"
    ],
    "schemas": [
      "approved_knowledge_chunk.metadata.embedding_profile",
      "approved_knowledge_chunk.metadata.embedding_normalized"
    ],
    "surfaces": [
      "apps/team"
    ],
    "agents": [
      "michael",
      "training-agent",
      "daily-success-coach"
    ]
  },
  "selected_topology": "local-master-knowledge+cloud-approved-mirror+production-query-embedder",
  "embedding_profile": {
    "id": "all-MiniLM-L6-v2-384-normalized-v1",
    "model": "sentence-transformers/all-MiniLM-L6-v2",
    "dimensions": 384,
    "normalized": true
  },
  "rejected_options": [
    "vps-reaches-local",
    "full-production-cloud-master-knowledge",
    "hosted-embeddings-primary-authority"
  ],
  "review": {
    "reviewers": [
      "Constitution & Governance",
      "Architect",
      "QA"
    ],
    "decision": "",
    "conditions": []
  },
  "approval": {
    "approved_by": "Kevin L. Gardner",
    "approved_at": "2026-07-01"
  },
  "implementation": {
    "branch": "",
    "commits": [],
    "append_only_respected": true
  },
  "verification": {
    "typecheck": false,
    "flows": [],
    "retrieval_readback": false,
    "private_content_exclusion": false
  },
  "release": {
    "gates_passed": [],
    "released_at": null
  },
  "version": {
    "from": "local-only/no-production-active-retrieval",
    "to": "cloud-approved-knowledge-retrieval",
    "supersedes": null,
    "rollback_to": "disable-cloud-retrieval"
  },
  "decision_ledger_ref": "dec_cloud_approved_knowledge_retrieval",
  "created_at": "2026-07-01",
  "updated_at": "2026-07-01"
}
```

---

## Approval

APPROVED — Kevin L. Gardner, 2026-07-01 (sole and final Constitutional Authority).

Approval terms ratified: The full/private master knowledge base remains local. Local infrastructure embeds and publishes only approved BA-facing knowledge every 12 hours into a versioned Chroma Cloud collection. The production app embeds live queries using the same normalized `all-MiniLM-L6-v2` 384-dimensional profile and queries Chroma Cloud directly through runtime adapters. The Gateway remains MCP/developer tooling only and is never part of the production request path. Agents consume retrieved knowledge only through the Context Manager / Knowledge Core boundary.
