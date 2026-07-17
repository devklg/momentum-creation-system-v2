# ACR-0034 — Konga Line Prospect Surface and Momentum Events

## Momentum Creation System V2

Status: Approved — repository implementation and verification authorized; merge and production apply unauthorized

Created: 2026-07-17

Priority: Konga Line surface

Change type: Contract · Surface · Persistence

Risk: High

Target Version: v1.4

Decision owner: Kevin L. Gardner

Proposer: Codex

Design approval: Kevin L. Gardner confirmed on 2026-07-17, “i approve of all
of the changes i discussed with spock (claude desktop).”

Ratified: Kevin L. Gardner, 2026-07-17 — “i approve”

Review evidence: Architecture/governance review completed clean after all
contract corrections; copy/compliance reconciliation completed in §9.

Decision ledger ref: `dec_acr_0034_konga_line_surface_approval_2026_07_17`

Reconciliation ref: `organization/ACR-0034-konga-line-prospect-surface-and-momentum-events.md`

---

## 1. Number and authority reconciliation

The Konga master brief requested ACR-0032 from a July 16 repository snapshot.
Current `origin/main` at `b365f3b7` already contains approved ACR-0032 and
ACR-0033. Reusing either identifier would corrupt the canonical ACR register.
This request is therefore registered as **ACR-0034**. Its scope and intent are
the Konga Line changes requested by the master brief; only the collision-free
identifier changed.

This proposal is subordinate to:

- `constitution/MOMENTUM_CONSTITUTION.md`;
- `constitution/MOMENTUM_DECISION_FRAMEWORK.md`;
- `constitution/MOMENTUM_ACR_SYSTEM.md`;
- `docs/locked-spec.md`, especially Parts 1–4;
- ACR-0011, for human sponsor attestation and enrollment-edge semantics;
- ACR-0033, for resource-catalog content-version authority;
- `D:/Kevins_Konga_line_Project/kevins-konga-line-north-star-v3-LOCKED.md`;
- `D:/Kevins_Konga_line_Project/konga-line-direction-d23-vertical.html`; and
- `D:/Kevins_Konga_line_Project/konga-dashboard-copy-deck-v1.md`, currently
  titled `KONGA DASHBOARD — PROSPECT-VOICE COPY DECK v1.6`; and
- `D:/Kevins_Konga_line_Project/konga-landing-preflight-pack.md`, which is a
  separately gated future scroll-world handoff and not part of this ACR.

The locked North Star is the design authority. The D-23 render is the visual
and token authority. Copy deck v1.6 is the language authority, subject to the
constitutional and fail-closed compliance gate in §9. Kevin's design approval
above confirms those Spock decisions; it is not inferred as approval of this
new architecture record or as merge authority.

## 2. Reconciled current state

The proposal extends existing architecture; it does not replace it:

- one team-wide, monotonic holding tank already places a prospect only after
  presentation-video completion;
- `McsPlacementTickerEntry`, `McsHoldingTankSnapshot`, and
  `McsPlacementEvent` already define the placement-only SSE contract;
- `/api/p/:token/stream` already emits `snapshot`, `placement`, and a
  30-second heartbeat, and reconnects converge from persisted state;
- sponsor identity is immutable from token mint;
- city and state/region already exist on ticker projections;
- `globalMaxPosition - myPosition` already supplies the live
  added-since-placement value;
- next-upcoming webinar events and countdown data already exist;
- prospect accounts already carry `lastLoginAt`, but no token-level
  last-seen-position contract exists;
- the BA activation report already derives signup, first invite, first video
  completion, and first enrollment; and
- the product has no prospect-linked operation that proves both off-app
  enrollment and real leg placement before emitting a public join event.

That last point corrects an assumption in the master brief. ACR-0011 defines
manual sponsor attestation and `ENROLLED` leg edges, but current `origin/main`
does not mount a recruiting-cycle attestation route that links an attested BA
back to a holding-tank prospect. Registration alone is not proof of that
mapping and must not produce a Konga join celebration.

## 3. Decision

Approve one Konga Line contract with two lenses:

- the `.com` prospect lens has the immutable inviting sponsor at the head;
- the `.team` BA lens has the authenticated BA at the head and does not exist
  until the BA creates their first invitation; and
- both lenses observe the same shared team-wide placement stream.

The surface is a vertical D-23 conveyor with the webinar destination at the
top, arrivals entering at the bottom, and the viewer's own node pinned in the
viewport. The ambient conveyor is presentation. Every arrival, join,
telemetry change, progress change, and celebration placed on it is driven by a
persisted real event. No simulated arrival, join, advancement, count, or
scarcity state is permitted.

Approval of this ACR would authorize implementation branches and local
verification only. It would not authorize a lane PR merge, production or
historical mutation, external provider call, recording publication, or
external communication.

## 4. Additive shared contracts

Lane 0 appends versioned Konga contracts to `packages/shared`; it does not
edit, rename, reorder, or widen existing exports. The legacy placement,
snapshot, and presentation-video types remain unchanged. The stream resolve
contract carries `contractVersion: "konga-v1"`, and the route plus hook accept
the explicitly versioned Konga payloads alongside legacy payloads during
rollback-safe migration.

### 4.1 Placement attribution

Lane 0 appends the public Konga projection without editing
`McsPlacementTickerEntry`:

```ts
export interface McsKongaAddedBy {
  firstName: string
  lastInitial: string
}

export type McsKongaPlacementTickerEntry = McsPlacementTickerEntry & {
  addedBy: McsKongaAddedBy | null
}

export type McsKongaPlacementEvent = McsKongaPlacementTickerEntry & {
  contractVersion: 'konga-v1'
  eventId: string
}
```

The existing `McsPoolPlacement.sponsorTmagId` remains the one immutable
internal sponsor identifier. No `addedByTmagId` or second sponsor-id concept
is introduced. At placement creation, the governed operation resolves the public
first-name/last-initial attribution from the existing immutable
`sponsorTmagId` and stores that minimized `addedBy` projection with the new
placement event in all required stores. Readers use the stored projection and
do not re-resolve sponsor identity for older rows. Existing placements that
lack the create-time projection render `null`. **No historical backfill or
reconciliation is authorized.**

### 4.2 Join event

`McsJoinEvent` is a public, content-minimized SSE payload:

```ts
{
  contractVersion: 'konga-v1'
  eventId: string
  positionNumber: number
  firstName: string
  lastInitial: string
  city: string
  stateOrRegion: string
  addedBy: { firstName: string; lastInitial: string } | null
  joinedAt: McsIsoTimestamp
}
```

`positionNumber` identifies the exact line node that exited. Prospect ids,
phone numbers, emails, full surnames, leg names, rank, compensation, and
earnings never enter the public event.

### 4.3 Snapshot telemetry

Lane 0 appends a versioned snapshot rather than editing
`McsHoldingTankSnapshot`:

```ts
export type McsKongaHoldingTankSnapshot =
  Omit<McsHoldingTankSnapshot, 'recent'> & {
    contractVersion: 'konga-v1'
    recent: McsKongaPlacementTickerEntry[]
    placementsThisWeek: number
    geoSpreadCount: number
    nextWebinar: McsWebinarEvent | null
    sinceLastVisit: number | null
    pageVisitId: string
  }
```

- `placementsThisWeek` counts persisted placements from Monday 00:00 in
  `America/Los_Angeles` through snapshot time.
- `geoSpreadCount` counts distinct normalized `(city, stateOrRegion)` pairs
  over that same window.
- `nextWebinar` is a projection of the existing webinar-event authority, not
  a second schedule record.
- `sinceLastVisit` is `null` on the first observed visit. Thereafter it is
  the non-negative difference between the current global position counter and
  the token's previously read-back `lastSeenGlobalPosition`. A top-level
  page load creates one client UUID `pageVisitId` before its first token
  resolve and reuses it for every automatic resolve retry and for the SSE
  stream query. The server validates the UUID, binds it to the resolved token,
  atomically captures the prior marker, and advances the stored marker once
  for that token/id pair. The resulting visit baseline is immutable for the
  life of `pageVisitId`. EventSource reconnects reuse the same id and compute
  against the captured baseline without advancing the marker. A genuine later
  navigation or refresh creates a new client UUID and advances the marker
  idempotently once. The id is telemetry-only, grants no access, and is rate
  limited with the token route.

The existing added-since-your-placement calculation remains
`max(0, globalMaxPosition - myPosition)` and is not redefined.

### 4.4 Replay and mission-funnel types

`McsWebinarReplay` binds a past webinar event to an immutable ACR-0033
`resourceVersionId`; it does not create a second media or content authority.
The replay contract carries event id, resource-version id, recorded date,
availability date, display date, and publication status.

Lane 0 appends `McsKongaVideoEventKind =
McsVideoEventKind | 'replay_complete'` and a Konga-specific request contract;
it does not edit `McsVideoEventKind` or `McsVideoEventPayload`.
`replay_complete` is replay-scoped. It must never enter the
presentation-video placement branch and must never create a second
holding-tank placement. It only records verified replay completion and
surfaces the existing human callback action.

Mission-funnel types are additive report/instrumentation contracts for
`signup`, `two_in_72_achieved`, `first_invite`, and `duplication_depth`.
Existing signup and first-invite facts remain canonical; the new projection
must reuse them rather than double-write parallel facts.

## 5. Truthful join and tank exit

A public `join` event may be emitted only by one governed enrollment operation
that completes all of the following:

1. resolves a live holding-tank prospect and immutable inviting sponsor;
2. records an authenticated human attestation that off-app enrollment and
   leg placement are complete, or an audited Kevin override with the same
   assertion;
3. stamps the prospect/token enrolled and the placement flushed with reason
   `enrolled` through the governed runtime persistence path;
4. preserves the monotonic position and removes the person from live tank
   projections without renumbering any position;
5. reads back the required MongoDB, Neo4j, and ChromaDB representations; and
6. only after successful read-back, publishes `McsJoinEvent` to the in-process
   SSE bus.

The authenticated BA CRM action may be extended into that governed operation,
but today's CRM close, `.team` registration, or ACR-0011 milestone evaluation
must not emit a join by themselves. ACR-0011 attestation may be reused only
when an exact prospect-to-new-BA linkage is present and verified. The public
event celebrates the attested human fact; it does not claim that MCS is the
THREE genealogy authority.

Admin force-enroll may publish only when it executes the same governed
operation and retains the audited override evidence. A partial persistence
failure produces no join event.

### 5.1 Placement-attempt identity and re-entry

Current placement idempotency is keyed only by `prospectId`, so current code
cannot satisfy the approved re-entry rule. Implementation therefore appends a
canonical `placementId` and a non-secret `placementAttemptId` derived from the
immutable invitation record id; raw invite tokens are never stored as ids.
Idempotency moves from “one placement for the lifetime of a prospect” to “one
placement for one invitation attempt,” while a prospect may have at most one
unflushed live placement.

- Repeated video-complete calls for the same invitation attempt return the
  same placement and never increment the pool counter twice.
- A fresh invitation may create a new attempt only after the prior placement
  is flushed. It mints a new `placementId`, increments the monotonic counter,
  and must receive a strictly newer position.
- The new invitation must agree with the prospect's existing immutable
  sponsor. Sponsor reassignment remains prohibited except through Kevin's
  separately audited override.
- Placement lookup used by current dashboard state selects the newest
  unflushed placement; history and audit views retain every attempt.
- Existing rows without the appended ids remain immutable legacy attempts.
  Readers derive a legacy identity in memory and do not backfill the rows.
- Mongo placement rows, Neo4j holding-tank relationships, Chroma pool events,
  SSE event ids, and read-back checks share the new `placementId`. Flush removes
  only the live relationship/pointer for that attempt and never deletes its
  historical record.

This is an additive schema and domain-contract change, not test-only wording.
It receives Schema and Architecture review under §11 before approval.

## 6. Replay, telemetry, and return-visit persistence

- Webinar recording metadata is published as an immutable resource-catalog
  version under ACR-0033. A replay becomes eligible only after an authorized
  human publishes that resource version.
- The current replay is the most recent eligible past webinar. Rotation
  changes the active pointer; it never edits an older webinar or recording.
- No recording provider, upload, hosting call, or historical rotation is
  authorized by this ACR.
- Token-level return-visit state stores only the last-seen global position and
  observation time. It is not a fingerprint and is never exposed across
  tokens.
- The top-level resolve operation creates or reuses an idempotent visit record
  keyed by resolved token identity and the client-supplied `pageVisitId`. It
  captures the prior marker and
  writes the new marker through the governed three-store path exactly once,
  then reads both back. SSE open and reconnect are read-only consumers of that
  captured baseline. A failed marker or visit-record write must not be
  represented as persisted, and reconnect must never collapse the visit delta.
- Weekly and geographic telemetry are projections over persisted placement
  facts. Live placement events update the client optimistically; reconnect
  always converges from a freshly computed snapshot.

## 7. Mission-funnel and BA-lens boundaries

The mission funnel extends the existing BA activation report and existing
canonical event sources. It does not create a parallel person score or a
second analytics authority.

- `signup` uses the existing member creation timestamp.
- `first_invite` uses the existing earliest invitation-sent fact.
- `two_in_72_achieved` requires two human-attested enrollments completed
  within 72 hours of the BA's real signup timestamp.
- `duplication_depth` is a report-only graph projection over attested
  enrollment relationships. It is not a rank, prediction, or prospect score.

The `.team` lens begins only after the authenticated BA's first real
invitation. Before then it shows the Ivory-linked genesis prompt. Its 72-hour
clock uses the real signup timestamp, displays 0/2 through 2/2, and is framed
as an effort-based launch mission. Presentation mode never fabricates events.
The inviter leaderboard is members-only, counts adds only, and never appears
in `.com` contracts or payloads.

## 8. D-23 surface scope

Lane 0 creates a Konga-scoped D-23 token module from the canonical render:

- ground `#05070F`, slate heritage `#0F172A`;
- structure/motion `#3B82F6`, value `#FACC15`, live `#06B6D4`;
- ink `#E4EAF6`, muted `#8CA0C4`;
- Orbitron display, Poppins body, Spline Sans Mono telemetry; and
- the single blue-to-gold gradient only on the wordmark and thesis accent.

This is a scoped Konga-surface token family, not an unreviewed replacement of
the repository's global brand tokens. Glow is signal; motion is data-bearing.
Pause-on-hover, visible mute, sound throttling, autoplay handling, and
`prefers-reduced-motion` are required. Arrival audio never plays over the
presentation video.

The 2025 Konga project is historical lineage, not current product authority.
Its chained-line mechanics and `application/client2/kevinskonga-frontend/src/assets/sounds/kongaized-join.mp3`
may be inspected and reused only after ownership and audio-behavior review.
NFT, tokenomics, commission, earnings, rank, spillover-calculator, scarcity,
and game-economy logic from that historical project are excluded. The July 17
scroll-world preflight pack remains the later cinematic-arrival track named in
the North Star and does not enter these implementation lanes.

Because North Star §8 contains no populated checklist, this ACR defines the
minimum visual design-audit evidence for Lanes B and C:

1. exact D-23 color roles and typography, with no substitute token values;
2. vertical upward line, destination dock at top, and a pinned own node;
3. telemetry numerals dominate their band and remain tabular and legible;
4. glass/HUD panels form one coherent mission-control composition, with no
   arbitrary gradients, excessive rounded-card repetition, decorative pills,
   or unrelated visual motifs;
5. hierarchy follows the locked reader-question sequence and keeps one clear
   repeated conversion action;
6. every data-bearing movement, node, count, pulse, and celebration traces to
   a captured real event; ambient conveyor motion is identified separately;
7. mute, sound throttle, pause, keyboard/focus, autoplay handling, and
   reduced-motion behavior are demonstrated;
8. desktop, tablet, mobile, small-mobile, and 200% reflow screenshots show no
   horizontal overflow, clipping, illegible telemetry, or obscured controls;
9. rendered copy passes provenance and fail-closed `.com` compliance; and
10. browser evidence shows no console exception or failed required request.

Copy deck v1.6 supplies the eight-section question-led information
architecture: Arrival, Product, Opportunity, Mechanic, Live Place, The
System, TM Advantage, and Real Conversation. The body for The System expands
verbatim from North Star §4's locked “THE SYSTEM YOU'VE BEEN PLACED INSIDE”
reference copy because the copy deck contains only its placeholder; that body
remains subject to the §9 implementation provenance and compliance gates. The callback request is the
one repeated conversion action. Rewatch and replay controls are content
controls, and the real webinar dock is an event interaction; neither may
become a second competing conversion promise.

## 9. Constitutional and compliance review — reconciled

The Future-Development Test is satisfied in purpose: the proposal makes real
team activity understandable, strengthens human follow-up, supports
duplication, and preserves effort-based action.

Kevin explicitly ruled on 2026-07-17 that the Kevin-authored phrases “you'd
earn from real work” and “new financial future” are intentional and do
neither of the prohibited things: they state no amount, projection, typical
result, timeframe, or guarantee. Their full context identifies a real,
effort-based business and expressly says there are no guarantees. They remain
verbatim approved copy and are not an income claim or earnings projection
under this project's constitutional boundary. The repository's prospect-copy
scanner does not prohibit either phrase.

Kevin resolved the remaining product-company naming conflict on 2026-07-17:
use the product name GLP-THREE and do not name the product company on `.com`.
The approved sentence is: “GLP-THREE is the product you just saw. Team
Magnificent is a team of people building businesses around sharing it — and
this page is their work, visible.” Copy deck v1.6 was updated accordingly.
This preserves Constitution Article VII.2 and locked-spec §§3.8 and 3.10.

The copy/compliance reconciliation is complete. This section no longer blocks
the formal Review gate. Product and market claims still require the sourced,
verbatim implementation evidence below.

The following are also implementation gates, not assumptions:

- every product efficacy, side-effect, PDR, launch-date, market-size, usage,
  and projection claim must match an approved source verbatim and carry the
  required source attribution;
- founder-mission numbers remain internal and never enter `.com` strings,
  fixtures, mocks, screenshots, or seed data;
- no income figures, CV/cycle/rank math, investment analogy, fake scarcity,
  permanence copy, current team head count, binary/leg insider language, or
  AI prospecting appears on `.com`;
- the system-support section may describe capabilities only in a way that
  keeps people at the center, keeps Steve/Michael BA-facing, and never implies
  that AI contacts, qualifies, or closes prospects; and
- the visible effort disclosure and canonical `.com` disclaimer remain
  fail-closed requirements.

## 10. Persistence and security

Every new durable runtime write uses the application's direct governed
MongoDB + Neo4j + ChromaDB path. Required new write families are placement
attribution, join attestation/tank exit, replay publication/rotation,
token-level last-seen markers, mission milestones, and BA launch progress.
No route may fan out stores by hand or publish SSE before persistence
read-back.

Public identity is limited to first name, last initial, city, and
state/region, plus the same minimized identity for `addedBy`. Full names,
phones, email, tokens, prospect ids, private notes, sponsor internals, and leg
details stay out of public SSE and `.com` render data. Sponsor attribution is
resolved from immutable server state, never accepted from a request body.

## 11. Implementation order and gates

1. Review evidence enumerates every affected document, contract, route,
   persistence boundary, and prospect/BA surface; records Architecture,
   Schema, Compliance, Constitution/Governance, and QA reviewer findings; runs
   the Future-Development Test; and proves no duplicate concept or hidden
   persistence path is introduced.
2. Kevin formally reviews and explicitly approves ACR-0034.
3. Approval produces a linked active decision-ledger row in
   `momentum.decisions` with `decision_ledger_ref` / `reconciliation_ref`
   before implementation authority is treated as current.
4. Lane 0 runs alone and opens a draft contracts PR.
5. Lane 0 merges only after green gates and separate explicit merge authority.
6. Server and `.com` lanes branch from the merged Lane 0 contract.
7. The `.team` lane starts only after Lane 0 and the shared Konga component
   from the `.com` lane have merged.
8. Agents open draft PRs; agents never self-merge. Each merge requires Kevin's
   separate authority after evidence review.

Per lane, evidence includes relevant tests, repo typecheck, production build,
a manual end-to-end flow against the running development server, generated
catalogs/freshness, route-access audit with zero findings, and `.com`
compliance with zero violations. Visual lanes additionally require desktop,
tablet, mobile, small-mobile, and 200% reflow checks; no horizontal overflow;
no console exceptions; reduced-motion verification; real-event-only motion
inspection; and every item in the §8 D-23 design-audit checklist. Shared-file
changes must remain append-only. Every implementation commit must use the
canonical integer chat number from the chat registry; no agent may invent a
number or advance the merge gate while that identity is unreconciled.

Every triple-stack test write is read back from all required stores. No
production write, provider call, recording upload, external communication,
historical attribution reconciliation, or live backfill is part of lane
verification.

## 12. Acceptance criteria

- New placements preserve immutable sponsor attribution by projecting the
  existing `sponsorTmagId`; legacy placements render safely with
  `addedBy: null`; no second sponsor field is created and no history is
  rewritten.
- Versioned Konga snapshot, placement-entry, placement-event, join, telemetry,
  replay, visit, and mission contracts are appended without editing legacy
  shared exports; every Konga SSE payload carries `contractVersion:
  'konga-v1'`, and the route/hook migration compiles from one shared
  authority.
- A join cannot emit without human enrollment/leg-placement attestation,
  exact tank exit, three-store read-back, and preserved monotonic position.
- Reconnect after missed SSE events converges to persisted truth.
- Weekly, geographic, added-since-placement, and since-last-visit telemetry
  match deterministic fixtures across week and timezone boundaries.
- Replay completion cannot place or re-place a prospect and surfaces only the
  human callback path.
- Expiration or enrollment flush releases the live slot without renumbering;
  re-entry creates a new placement with a strictly newer position, and tests
  prove both behaviors.
- The BA lens has no line before first invite; its first real invited prospect
  is the first node. It uses the real signup clock and keeps the leaderboard
  members-only.
- Mission reporting extends current activation authority and introduces no
  person scoring, prediction, or automated outreach.
- D-23 tokens are single-source, the own node remains pinned, motion/sound
  accessibility works, and no simulated event is present in production code,
  fixtures rendered to `.com`, or seed data.
- Copy deck v1.6's section order, question headers, Kevin-authored financial
  language, and §9-approved GLP-THREE wording are preserved.
- `.com` compliance reports zero violations and all factual copy has approved
  provenance.

## 13. Rollback

The rollback target is the current six-section dashboard, placement-only SSE
contract, and pre-Konga dashboard styling at `origin/main` commit `b365f3b7`.
Contracts are additive and surface activation must be reversible without
deleting new records. Rollback disables the Konga projections/components and
restores the prior readers; it does not destroy placement attribution, join
attestation, replay metadata, visit markers, or mission events already written.
Any destructive cleanup or historical data change requires a separate ACR and
Kevin apply authority.

## 14. Authority boundary

Kevin's approval authorizes repository implementation and verification of
ACR-0034 in the dependency order defined in §11. It does not authorize any PR
merge, production apply, historical reconciliation, provider call, recording
publication, or communication beyond the governed Intervector handoff. The
design, architecture, Kevin-authored earnings/opportunity phrasing, and §9
GLP-THREE company-name correction are approved. Each implementation PR still
requires separate explicit merge authority after its gates pass.
