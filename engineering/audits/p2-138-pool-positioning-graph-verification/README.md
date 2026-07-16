# P2-138 pool positioning graph verification

Date: 2026-07-16

## Scope

P2-138 adds a test-only, read-only verification runner for the locked
team-wide holding-tank position contract. MongoDB remains canonical; the
runner compares its placement and counter evidence with Neo4j
`IN_HOLDING_TANK` edges.

The seven checks cover:

1. the single canonical `tm_team_pool`;
2. one placement and graph edge per prospect;
3. unique positive positions without treating valid gaps as findings;
4. a nonnegative counter that covers the highest minted position;
5. timestamp order across monotonically increasing positions;
6. paired, governed flush metadata that retains the original edge; and
7. exact Mongo-to-Neo4j property parity.

## Verification

- Focused tests: 10 passed across the new verifier and the existing
  pool-placement persistence contract.
- Full server suite: 2,215 passed and 19 skipped. The live Context Manager
  feature flag was explicitly disabled for the inert runtime-route test
  contract; with the developer `.env` live flag inherited, those unrelated
  tests time out while attempting live retrieval.
- Repo typecheck and production build: passed.
- Dedicated MCS MongoDB (`127.0.0.1:30000`) and Neo4j
  (`127.0.0.1:7710`) read-only observation: seven of seven invariants
  completed, zero findings, zero degraded checks, and zero placement rows or
  graph edges in the currently empty pre-launch holding tank.
- Every source query is statically rejected if it contains a mutation clause
  or omits its bounded scan/sample parameter. The runner fails closed on
  malformed store results, query errors, or scan-limit overflow.

## Safety boundary

The runner uses bounded reads and content-minimized SHA-256 sample
fingerprints. It does not change placement behavior, repair graph state,
reclaim gaps, renumber positions, apply indexes/constraints, write to Chroma,
mount a route, add an admin control, or send an external communication.
