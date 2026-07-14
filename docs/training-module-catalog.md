# Training Module Catalog

P2-110 establishes `packages/shared/src/training-catalog.ts` as the current,
machine-readable inventory of implemented training modules. The catalog records
stable module ids, access prerequisites, explicit completion evidence, content
sources, Team routes, progress routes, and resource context tags.

## Current catalog scope

The implemented self-paced program is the five-module Fast Start Guide:

1. The Product
2. Comp Plan, Layer 1
3. The Binary as Two Legs
4. Build Your Prospect List
5. Build Your Team

Module order is recommended but is not hard-gated. Module 1 requires an
authenticated BA. Modules 2–5 also require Steve Discovery to be complete.
Each module completes only when the BA explicitly records `completed` in
`tmag_fast_start_progress`; elapsed time never creates completion evidence.
Fast Start completes only when every catalog module is complete and at least
one invitation has been sent according to `tmag_prospects.sentAt`.

The catalog is a projection of current implementation truth, not the content
authority. Training copy remains owned by the route source files and the
approved references named in each catalog entry.

The ten-step orientation route remains adjacent live curriculum, not a Fast
Start module. It has no durable completion source today and the catalog does
not infer one. Resource Center materials support training but do not own module
sequence or progress.

## Target reconciliation

`TRAINING_ARCHITECTURE.md` describes a larger target curriculum. P2-110 does
not claim that target is implemented and does not silently map current Fast
Start modules onto it. P2-111 records the explicit target-versus-current
reconciliation in `docs/training-target-reconciliation.md` and
`packages/shared/src/training-target-reconciliation.ts`. This separation keeps
the current catalog factual while making every target gap explicit.
