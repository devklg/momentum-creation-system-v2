# Resource Center Product Boundary

Decision: **Resource Center is a named, authenticated Brand Ambassador library at `/resources`.** It is a governed discovery layer over source-owned resources, not a new content authority and not an umbrella name for every education workflow.

The current Product Gallery/video library, Fast Start and 10-step training, and approved Knowledge Core are Resource Center source domains. They remain authoritative for their own content and workflows. They do not collectively constitute the Resource Center until eligible versions are projected through the resource catalog and exposed by the named library. Event schedules and reservations are not resources; event-owned materials join through P2-101 after a material source exists.

The executable boundary catalog is `packages/shared/src/resource-center-catalog.ts`.

## Audience and routes

- Primary user surface: authenticated `.team` Brand Ambassadors and leaders at `/resources`.
- Owner plane: Kevin-only administration through the existing `/knowledge` and `/content-videos` surfaces; catalog lifecycle/readiness controls remain to be surfaced by later Resource Center work.
- Existing deep links remain valid: `/video-library`, `/training/fast-start`, and `/training/10-steps`.
- No public or prospect-facing Resource Center route is authorized by this decision.
- P2-100 owns `/resources` UI, search, filters, categories, and result rendering. P2-99 does not add that route or UI.

## Ownership

Resource Center owns discovery, browse/search/filter behavior, and deep links back to source owners. Product Gallery owns content videos; Training owns sequence, module content, and completion; Knowledge Core owns approved source and chunk authority; Event Center owns events and future event materials. Source records are not copied into a second authority.

The video library and Product Gallery are one current product surface, not two independent resource sources. The database-backed `tmag_content_videos` gallery is the displayed source; the static `MCS_PRODUCT_CATALOG` remains a Generator dependency that requires later convergence rather than silent promotion to Resource Center authority.

## Version safety

Every Resource Center result must resolve to `resource_catalog.v1`. Only an `active`, audience-eligible version with active human authority may be shown. Retrieval fails closed unless Mongo `tmag_resource_catalog`, Neo4j `TmagResource`/`TmagResourceVersion`, and Chroma `mcs_resource_catalog` agree on exact identity, immutable version, SHA-256 digest, and projection freshness.

Legacy `active` booleans, inline training content, repository files, and semantic similarity are not publication evidence. Existing sources require catalog projection with owner, audience, lifecycle, version, digest, locator, lineage, and readiness. The catalog is a projection; the source domain remains authoritative.

## Exclusions

Resource Center is not:

- a training sequence or completion tracker;
- an event scheduler, registration system, attendance record, or CRM;
- a public `.com` content library;
- a raw admin authoring surface;
- a way to expose candidate, unapproved, private, stale, superseded, or audience-mismatched knowledge;
- a second authority over Product Gallery, Training, Knowledge Core, Event Center, or master content;
- permission for AI or semantic search to decide truth.

This boundary reconciles the already-ratified Resource Center education surface. It does not change the frozen architecture, shared resource schema, persistence contract, or compliance boundary.
