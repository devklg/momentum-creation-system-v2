# Prompt Review, Versioning, and Deployment Approval Workflow

P1-63 implements an executable prompt lifecycle in
`packages/shared/src/prompt-governance.ts`:

`draft → in_review → approved → active → deprecated → retired`

Review can reject a version. Leadership can roll an active version back to a
known immutable approved/deprecated version in the same prompt slot.

The workflow enforces semantic versions, owners, source references, allowed
inputs, forbidden outputs, degradation behavior, tests, independent review,
passing tests before approval, immutable approved versions, one active version
per slot, leadership-controlled deprecation/retirement/rollback, reasons, and
append-only event envelopes for every transition.

Persistence and admin UI build on this contract in later slices; this workflow
contains no self-deployment or prompt self-modification.
