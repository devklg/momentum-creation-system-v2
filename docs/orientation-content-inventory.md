# Current orientation content inventory

P2-117 records the participant-facing orientation content that exists now. The
machine-readable contract is `orientation_content_inventory.v1` in
`packages/shared/src/orientation-content-inventory.ts`.

## Current implemented curriculum

The current curriculum is the ten-step page at `/training/10-steps`, grounded
in `docs/locked-spec.md` Part 4.5 (locked Chat #99) and implemented in
`apps/team/src/routes/training/10-steps.tsx`. It is used as a shared visual aid
during a founder/leader-hosted live group session and as a permanent reference
afterward; it is not self-paced.

The implemented content inventory contains exactly ten ordered steps. Every
step has a participant-facing description and a host-insight block. The page
also contains its hero, contextual resources, PMV+C mantra, and training
disclaimer. Automated QA reads the source page and locked spec to validate the
step count, order, titles, structural blocks, route, and supporting content.

This `.team` curriculum is adjacent to Fast Start. It is not a Fast Start
module and has no module-progress authority. The locked Chat #99 curriculum
supersedes the older placeholder described in historical comparison notes.
The contextual-resource block is an optional extension limited to active,
approved resource-catalog entries; it is not curriculum sequence, attendance,
or completion evidence.

Current gaps remain visible: English exists and Spanish does not; no durable
content-version authority binds the page to a scheduled session; and no record
proves what a host actually delivered. P2-142 is the planned content-versioning
item. External legacy onboarding material that is not shipped in this repo is
not counted as current implementation.

Although the regulated curriculum is intended for the `.team` surface,
`TeamShell` is presently a layout wrapper rather than evidenced authentication
enforcement. The inventory therefore records authentication enforcement as
`not_evidenced`; it does not make a false access-control claim or silently
change access policy within this inventory item.

## Current operating truth

The current runtime remains the live group-session scheduler documented in
`docs/orientation-state-machine.md`. Session and reservation records support
scheduling and cancellation only. The app has no attendance authority and no
orientation-completion authority. A reservation or elapsed session never
proves attendance or completion.

## Planned target kept separate

`ORIENTATION_ARCHITECTURE.md` describes a future Stage 0 through Stage 10
experience. Its stage records, attendance capture, completion record, personal
next-step selection, and launch-transition writes are not implemented. This
inventory does not promote that architecture into current runtime truth.

The inventory is a factual projection, not new content approval. It does not
rank, score, classify, or compare people, and it authorizes no prospect-facing
use of the regulated training content.
