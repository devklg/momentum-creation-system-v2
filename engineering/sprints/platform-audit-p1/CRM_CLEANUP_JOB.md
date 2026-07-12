# CRM Cleanup Job

P1-57 adds a conservative repair job for CRM records and follow-up reminders
that are provably stale from authoritative persisted evidence. It is a cleanup
mechanism, not a general integrity report and not a substitute for Brand
Ambassador judgment.

## Commands

Run the bounded candidate scan without changing state:

```bash
pnpm --filter @momentum/server cleanup:crm -- --dry-run
```

Apply the same deterministic cleanup rules:

```bash
pnpm --filter @momentum/server cleanup:crm -- --apply
```

Dry-run is explicit and non-mutating. Apply mode is also explicit; the command
does not infer permission to mutate from the absence of a flag.

## Conservative cleanup rules

The implementation lives in `server/src/domain/crmCleanup.ts`. It may repair a
row only when the current persisted records provide unambiguous evidence:

- An active follow-up may be cleared when its prospect is terminal,
  soft-deleted, or its explicit CRM record is already closed.
- A CRM record's denormalized `followUpDueAt` may be synchronized to the active
  reminder's due time, or cleared when no active reminder remains.
- Cleanup preserves history. It stamps state through the existing CRM and
  follow-up persistence paths; it does not hard-delete CRM, follow-up, timeline,
  or audit records.

The job deliberately does **not**:

- close a CRM record because it is old or inactive;
- clear a reminder merely because its due time has passed;
- interpret a due follow-up as stuck -- `follow_up_due` is a valid action state;
- guess between conflicting or incomplete lifecycle rails;
- repair ambiguous orphan or cross-store integrity findings.

Those ambiguous findings belong in the P1-58 admin state integrity report.

## Idempotency and race safety

Candidate reads do not themselves produce writes or audit entries. Before an
apply mutation, the job checks the current persisted state again and conditions
the update on the state that made the row eligible. A row changed by another
request is skipped instead of overwritten.

Re-running apply mode after a successful pass is a no-op for those records.
Already-cleared follow-ups, already-synchronized CRM due times, and race-lost
candidates do not receive duplicate cleanup entries.
Failures are collected so one bad candidate does not abort the rest of the
bounded pass.

## Evidence and counters

The result distinguishes at least the operational facts needed to verify a run:

- candidates scanned;
- CRM follow-up due dates reconciled;
- terminal follow-ups cleared;
- records skipped because they were already correct or changed concurrently;
- failed candidates with identifying context and an error.

Dry-run returns candidate and projected-action counts without mutation. Apply
returns actual mutation, skip, and failure counts. These counters are run
evidence; they are not prospect scoring, qualification, or prioritization.

Every successful apply-mode transition appends one entry through the canonical
`appendAuditEntry()` substrate with a system cleanup actor, prospect entity,
specific action, exact before/after state, and the terminal or duplicate reason.
No audit row is emitted for dry-run candidates, validation failures, no-ops, or
lost races. Prospect-visible lifecycle changes use the existing timeline event
kinds where applicable; worker diagnostics do not become prospect timeline
noise.

## Persistence boundary

P1-57 introduces no new business collection. CRM records, follow-ups, prospect
timeline events, and `mcs_audit_log` remain the existing sources and evidence
stores. The cleanup job uses the repository-approved persistence helpers so
Mongo state and its Neo4j/Chroma projections retain the same durability and
readback expectations as ordinary CRM mutations.

P1-58 is the next item. It will expose stuck, duplicated, orphaned, and
inconsistent state to the admin surface, including duplicate follow-ups and
terminal CRM mismatches this conservative job intentionally refuses to mutate.
