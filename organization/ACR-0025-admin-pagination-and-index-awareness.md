# ACR-0025 — Admin Pagination and Index Awareness

**Status:** APPROVED — Kevin L. Gardner, 2026-07-13
**Authorship:** Agent-authored proposal approved by Kevin as the recommended P2-131 bundle
**Risk:** Medium — additive admin API/surface contracts and read-query/index behavior
**Change type:** Contract / surface / persistence-read pattern
**Audit authority:** `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` P2-131 and `PLATFORM_AUDIT.md:798,875`
**Affected boundary:** Kevin-only admin BA, prospect, event, resource, and audit-log high-volume row sets
**Target version:** v1.2
**Decision ledger:** `dec_acr_0025_admin_pagination_approval_2026_07_13`

## Purpose

Replace silent high-volume caps and whole-dataset admin reads with bounded,
deterministic pages whose required Mongo indexes are named and whose observed
index state is reported honestly. This ACR does not authorize production
mutation or make the generated index catalog proof that an index is installed.

## Constitutional check

**Future-Development Test:** Pass. The approved change increases clarity and
sustainability, simplifies high-volume admin
operation, and preserves human authority, privacy, equal treatment, and the
existing compliance boundaries. Reviewed boundaries: no-scoring, sponsor
immutability, THREE upstream authority, privacy-minimal audit records, Kevin-only
admin access, fail-closed external communication, and production-write safety.
No constitutional boundary is expanded.

## Reconciled current state

- `/api/admin/audit` already provides the local cursor pattern: a bounded page,
  stable compound order, and `nextCursor`. Its UI/response shape remains
  unchanged, but its current planned indexes omit the `entryId` tie-breaker and
  an unknown cursor can replay page one; both defects remain in scope.
- `/api/admin/prospects` can read 50,000 prospects and four 50,000-record joins,
  then sends the full array to the browser for filtering and sorting.
- `/api/admin/bas` returns one capped page (500 by default, 2,000 maximum),
  duplicates roster data in a legacy `bas` field, and performs multi-collection
  joins. Its internal `fetchAllPaged()` supplies `skip`, but the direct Mongo
  adapter does not apply `skip`; that helper must not be copied as pagination
  authority.
- Event reservations and Resource Center row sets are returned as bounded or
  whole aggregates without a shared high-volume page contract. Resource usage
  currently performs two whole-event aggregations and globally sorts derived
  rows by `openCount DESC, title ASC`.
- The generated Mongo index audit is planning evidence only. On current main it
  reports 42 `planned_missing_enforcement` rows and six registry-declared VM
  rows; freshness does not prove that production indexes exist.

## Approved invariant contract

Every in-scope high-volume row set will use these invariants:

1. Pagination is keyset/cursor based, never deep `skip`/offset paging.
2. The cursor is opaque to clients, contains stable sort keys only, and is
   authenticated/tamper-evident (or resolved from server-side cursor state) so
   it is bound to the active filter/sort contract. It contains no contact
   details, notes, tokens, access codes, or row content.
3. Queries use `pageSize + 1` to determine `hasMore`; no expensive total count
   is required unless Kevin explicitly reserves one below.
4. Ordering uses a source-owned timestamp plus a stable unique identifier as a
   tie-breaker, with both directions encoded in one named compound index.
5. Filters apply before pagination. Joins and projections are page-scoped.
   Every join query must have a reconciled matching index specification before
   implementation; primary-table indexes alone are insufficient.
6. Invalid, malformed, unknown, or filter-mismatched cursors fail with HTTP 400;
   they never replay page one.
7. Responses expose `pageInfo: { pageSize, hasMore, nextCursor }`, the applied
   filter/sort contract, and `computedAt`. They do not claim snapshot-exact
   directory totals across concurrent writes. Existing source-owned Event and
   Resource aggregate summaries remain independent of page contents and must
   never be recomputed from only the current page.
8. Pagination audit records contain only filter/page metadata and returned
   count—not row content, phone, email, invite token, access code, or notes.
9. Admin authentication, detail routes, mutation routes, source authority,
   sponsor immutability, compliance boundaries, and human-only actions remain
   unchanged.
10. UI controls reset on filter/sort changes, deduplicate appended rows by
    canonical id, ignore stale responses, disable during loading, and state
    bounded-result truth plainly.
11. The broken BA `fetchAllPaged()`/ignored-`skip` path is replaced with tested
    keyset or bounded aggregate reads before P2-131 can complete. The existing
    helper is not a valid pagination primitive.

## Approved surface scope and index identities

| Row set | Approved stable order | Required named non-unique indexes |
| --- | --- | --- |
| BA directory | `createdAt DESC, tmagId DESC` | `admin_createdAt_tmagId` on `{ createdAt: -1, tmagId: -1 }` |
| Prospect directory | `createdAt DESC, prospectId DESC` | `admin_createdAt_prospectId` on `{ createdAt: -1, prospectId: -1 }`; `admin_sponsor_createdAt_prospectId` on `{ sponsorTmagId: 1, createdAt: -1, prospectId: -1 }` |
| Webinar reservation rows | `createdAt DESC, reservationId DESC` within the selected event set | `admin_event_createdAt_reservationId` on `{ eventId: 1, createdAt: -1, reservationId: -1 }`; retain prospect-specific indexes for detail joins |
| Resource usage rows | catalog `updatedAt DESC, resourceVersionId DESC` for page-first reads; complete source-owned usage aggregates remain separate | Active sources are `tmag_resource_catalog` and `tmag_resource_usage_events`. The page-first catalog requires a matching active-audience/catalog cursor index plus usage-event indexes beginning with `resourceVersionId` and covering `eventType`/`occurredAt`. No new collection or indexed summary model is authorized by this ACR. |
| Audit log index/cursor validation | existing `timestamp DESC, entryId DESC` | add/verify `admin_timestamp_entryId` on `{ timestamp: -1, entryId: -1 }` and matching severity/entity variants where those filters are supported; malformed or unknown cursors must fail 400 |

These are approved query shapes, not approval to create indexes. Exact existing
field/collection names must be confirmed before implementation, and the ACR
must be revised rather than inventing aliases where a source lacks a stable
timestamp or identifier.

Before implementation, the review gate must also enumerate and verify the exact
join indexes used by the approved query shapes. At minimum this covers BA joins
for access-code owner/active state, commitment `tmagId`, invite-token
`sponsorTmagId`/time, open follow-up `sponsorTmagId`/due time, Fast Start
`tmagId`/state, and curated-tag `tmagId`; and prospect joins for placement,
token, callback, and webinar records by `prospectId` plus their latest-record
time where applicable. Missing field or collection authority blocks
implementation; it is not permission to invent an alias.

## Index-awareness and production-safety rule

The implementation may add read-only preflight/drift reporting that compares
required index specifications with observed Mongo index metadata. Reporting
must distinguish `required`, `observed`, `missing`, and `definition_mismatch`.
It must never label a planned catalog row as installed.

No `createIndex`, migration, production write, or automatic application of the
P1 48-index plan is authorized by this approval. A complete named index
manifest must be produced from the approved query shapes and reviewed through
an amended ACR-0025 (or successor ACR) before any creation is considered. Any
later approved index creation must run idempotently in a safe non-production
environment first, produce a read-back evidence package, and receive Kevin's
separate explicit production authority before production mutation.
Unique-index creation is excluded.

## Kevin-approved decisions

Kevin approved the recommended P2-131 bundle on 2026-07-13:

1. Use the stable orders and unique tie-breakers named in this ACR.
2. Add pagination to the existing endpoints; do not create parallel paged
   endpoint families.
3. Retain the legacy `/api/admin/bas` `bas` full-array field for one documented
   transition release, then remove it only through a separately versioned change.
4. Move the currently supported directory search and sortable columns
   server-side with matching cursor/index behavior. Any unsupported key must be
   visibly narrowed and documented; current-page-only search/sort is prohibited.
5. Omit matched totals in favor of honest `hasMore`. Existing source-owned Event
   and Resource aggregate summaries remain complete and separate from page rows.
6. Use page-first Resource catalog ordering `updatedAt DESC,
   resourceVersionId DESC`; keep complete source-owned usage aggregates separate.

Index authority is verify/report-only. This approval does not authorize index
creation; a complete manifest and later explicit approval are mandatory.

## Explicit exclusions

- No scoring, ranking, qualification, comparison, or classification of people.
- No prospect-facing change and no live email, SMS, call, or external action.
- No new source of truth, collection, parallel audit taxonomy, or hidden cache.
- No change to the audit-log page contract under this ACR.
- Audit cursor validation and compound-index verification remain in scope even
  though its visible page contract is unchanged.
- No client-only slicing presented as server pagination.
- No automatic full-catalog index application and no production mutation.

## Verification required after approval

- Domain tests: page-size bounds, `pageSize + 1`, equal-timestamp tie cases,
  complete no-gap/no-duplicate traversal, filtered traversal, and terminal page.
- Audit regression tests: compound ordering and malformed/unknown cursor 400,
  without page-one replay.
- Route tests: admin auth, invalid cursor/limit 400, additive contract shape, and
  privacy-minimal audit metadata.
- UI tests: initial page, load-more append/dedupe, reset on filter/sort, stale
  response isolation, disabled loading control, and empty/error/terminal states.
- Index tests: exact required definitions, honest observed-state reporting, and
  `pnpm catalog:mongo-indexes:check` without claiming enforcement.
- BA regression tests must prove join batching cannot repeat page one or inflate
  invite/training/follow-up aggregates at an exact batch boundary.
- Focused suites, server/admin suites, route-access gates, repo typecheck/build,
  and trusted visual QA for changed controls at narrow and wide viewports.
- If index creation is later authorized: safe non-production application plus
  canonical Mongo index read-back before any production decision.

## Rollback

Rollback returns clients and routes to their currently approved bounded/full
array contracts and removes the additive page metadata/controls. It does not
drop indexes automatically. Any later index removal is a separate approved,
read-back-evidenced operation.

## Approval record

Kevin approved the recommended P2-131 bundle in the active Codex task on
2026-07-13. The approval was read back from MongoDB, Neo4j, and ChromaDB under
`dec_acr_0025_admin_pagination_approval_2026_07_13`. Implementation is authorized
on `codex/p2-131-admin-pagination` under the six decisions above. Index creation,
automatic index application, and production mutation remain unauthorized.
