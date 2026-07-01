# P4.5A — Knowledge Intake / Parsing Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Bridge Slice P4.5A

This is the **official contract** for transforming a raw source Kevin adds into retrieval
units the Context Manager can place into a Context Packet. It conforms to and extends the
ratified `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md`, `runtime/KNOWLEDGE_CORE_RUNTIME.md`,
`runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`, and ACR-0008 (author fast-lane). It governs the
**intake/parsing/indexing seam only** — it adds no persistence, no routes, no LLM, no Phase 7
learning.

### Load-bearing rule

> **Raw source is authority. Parsed chunks are retrieval units. Context Packets consume
> relevant chunks. Agents never browse the raw knowledge pool directly.**

The flow is one direction with a preserved origin at every hop:

```
RawKnowledgeSource  ──parse──▶  ParsedKnowledgeDocument  ──chunk──▶  KnowledgeChunk[]  ──index──▶  KnowledgeIndexRecord[]
      (authority)                  (normalized view)               (retrieval units)            (index-ready)
        ▲                              │ sourceId                     │ sourceId,documentId        │ chunkId,sourceId
        └──────────────────────────────┴──────────────────────────────┴────────────────────────────┘
                              every derived record points back to the raw source
```

Retrieval consumes **chunks/index records mapped to `KnowledgeReference`** — never `originalContent`.

---

## 1. Raw source preservation

- `RawKnowledgeSource.originalContent` is stored **verbatim** and is never mutated by parsing,
  chunking, or indexing. It is the single point of authority and traceability.
- Re-parsing a source MUST NOT alter the raw source. Parsing is a pure projection.
- Each source carries `version` (monotonic content version). New content = new version; the
  prior version is supersedable/archivable, never silently overwritten (matches the existing
  monotonic + provenance discipline elsewhere in the system).

## 2. Text normalization (deterministic only)

Allowed, deterministic transforms only:
- strip unsafe markup (`<script>` / `<style>` blocks and all HTML tags for `html` format);
- decode a small fixed set of HTML entities (`&amp; &lt; &gt; &quot; &#39; &nbsp;`);
- normalize whitespace (collapse intra-line runs, trim trailing spaces, collapse 3+ blank
  lines to one, trim ends);
- preserve heading structure markers needed for section detection.

**Forbidden:** rewriting Kevin's meaning, summarizing as a replacement for source, inventing
missing text, classifying people, creating doctrine, changing the raw source, or any LLM
interpretation. Normalization is byte-deterministic: same input → same `normalizedText`.

## 3. Section detection

- `markdown`: lines matching `^#{1,6}\s+` open a section; `level` = number of `#`. Text before
  the first heading is a **preamble** section (`heading: null`, `level: 0`).
- `html`: `<h1..h6>` become section boundaries (mapped to `level` 1..6) after tag stripping.
- `plain_text`: the whole document is one preamble section (`heading: null`, `level: 0`).
- Offsets (`startOffset`/`endOffset`) are recorded **into `normalizedText`** ("source offsets
  where practical"), giving honest, reproducible spans without claiming byte positions in
  pre-normalized markup.

## 4. Chunk creation

- Each section is split into one or more `KnowledgeChunk`s of bounded size
  (`maxChunkChars`, default 1200) on paragraph/sentence boundaries; a section under the bound
  is exactly one chunk. Splitting is deterministic and never merges across section boundaries.
- `chunkIndex` is **document-global** (0..n) in reading order.
- Each chunk retains its section `heading` and a `sourceOffsets` span into `normalizedText`.

## 5. Metadata attachment

Every chunk carries forward, unchanged, the source-level metadata: `language`, `domain`,
`scope` (Team Magnificent), plus `topicTags`, `agentScopes` (which agents may use it), and
`surfaceScopes`. `surfaceScopes` is constrained to `team` / `admin` — **never `com`** — so the
compliance "never on `.com`" rule is encoded structurally in the type, not left to a reviewer.

## 6. Retrieval reference creation (the join to P4.4)

An **eligible** chunk maps to the existing `KnowledgeReference` shape (P4.2):

```
KnowledgeChunk (eligible)  ─▶  KnowledgeReference {
  knowledgeId,                  // deterministic, derived from chunkId
  domain,                       // carried from chunk
  status: 'active',             // Kevin-added = official/active (author fast-lane, ACR-0008)
  language,                     // carried from chunk
  translationStatus: 'same_language',
  sourceId,                     // carried — traceable to the raw source
}
```

Because this is exactly what `ApprovedKnowledgeProvider.listApprovedKnowledge` returns, the
mapped references flow through the **existing** P4.4 adapter and P4.5 packet assembly with no
change to those slices. Kevin-added knowledge becomes active knowledge **because Kevin added
it** — approval is a given (per the slice brief), so no review queue is introduced here.

## 7. Index-ready record creation

`KnowledgeIndexRecord` is the index-shaped projection of a chunk:
- `searchableText` = the chunk text (deterministic; no embedding, no summarization here);
- `retrievalKey` = stable composite (`{domain}:{language}:{chunkId}`);
- `knowledgeId` = the same deterministic id used by the mapping in §6;
- `status` = `indexed` for eligible chunks, `excluded` otherwise (with traceable `chunkId`).
- **No vector/graph write occurs.** Embedding + triple-stack indexing is Phase 8 and is
  explicitly out of scope (DB write-freeze; ACR-0008 implementation gate).

## 8. Runtime eligibility

A chunk is retrieval-eligible **only** when ALL hold (fail-closed — any miss excludes):
- `status === 'active'`;
- `retrievalEligible === true`;
- scope is Team Magnificent and matches the request scope;
- language matches the request language (language **fallback** is deferred to P4.6 and is inert
  here, mirroring the P4.4 adapter);
- not `deprecated`, not `archived`, not `rejected`, not `parse_failed`.

## 9. Traceability back to raw source

- `ParsedKnowledgeDocument.sourceId` ⇒ raw source.
- `KnowledgeChunk.sourceId` + `KnowledgeChunk.documentId` ⇒ document ⇒ raw source.
- `KnowledgeIndexRecord.sourceId` + `.chunkId` + `.documentId` ⇒ chunk ⇒ document ⇒ raw source.
- IDs are **deterministic** functions of stable inputs (`sourceId`, `version`, `chunkIndex`),
  so the same raw source re-parsed yields identical document/chunk/index ids — traceability is
  reproducible, not run-dependent.

## 10. Version handling

- `version` is the unit of content change. Derived ids incorporate `version`, so v1 and v2 of a
  source produce distinct documents/chunks/index records — old retrieval units remain
  addressable while new ones supersede them.

## 11. Deprecation / archive behavior

- Lifecycle on derived units: `active → deprecated | archived | rejected` (plus the parser-set
  `parse_failed`). Only `active` chunks are retrieval-eligible.
- Deprecating/archiving a source flips derived chunks out of eligibility **without deleting**
  them — the raw source and its trail are preserved (curation is reversible).
- `parse_failed` chunks are produced when a source cannot be parsed (e.g. empty/whitespace-only
  content); they are permanently ineligible and never mapped to a `KnowledgeReference`.

---

### Conformance summary

| Concern | This contract | Enforced by |
|---|---|---|
| Agents never read raw stores | Retrieval consumes chunks→references only | mapping in §6; governance test |
| Context Manager sole assembler | Intake produces references; never calls `buildContextPacket` | governance test |
| Candidate vs approved | Kevin-added = active; ineligible states excluded fail-closed | §8 predicate + P4.2 validators |
| No `.com`, no `/api/runtime`, no LLM, no voice | structural (`surfaceScopes` excludes `com`) + deterministic parsing | types + governance test |
| No persistence drift | inert utilities; no Mongo/Neo4j/Chroma/GridFS/Gateway | governance test + DB write-freeze |
