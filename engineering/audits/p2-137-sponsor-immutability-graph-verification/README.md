# P2-137 sponsor immutability graph verification

Date: 2026-07-16

## Scope

P2-137 adds a test-only, read-only Neo4j verification catalog for the locked
sponsor invariants. It does not mount an application route, change sponsor
assignment behavior, repair graph state, or apply constraints/indexes.

The eight exact-count checks cover:

1. ambiguous non-superseded member sponsor edges;
2. self-sponsor edges;
3. audited overrides without exactly one current sponsor;
4. audited overrides without preserved original-sponsor history;
5. prospect sponsor property versus the inviting member;
6. invite-token sponsor propagation through its prospect and inviter;
7. prospect-account re-entry binding through account, token, prospect, and BA;
8. access-code ownership cardinality across governed owner relationships.

## Verification

- Focused tests: 17 passed across BA identity, sponsor override/access-code,
  token lifecycle, and the new verification runner.
- Server typecheck: passed after building the shared workspace declarations.
- Dedicated MCS Neo4j stack (`127.0.0.1:7710`): eight of eight read-only
  traversals completed with zero findings and zero degraded checks.
- Every catalog query is statically rejected if it contains a mutation clause,
  omits exact counting, or omits the bounded sample parameter.

## Safety boundary

No production mutation, graph repair, sponsor reassignment, live
constraint/index apply, external communication, or policy expansion was
performed or authorized by this verification slice.
