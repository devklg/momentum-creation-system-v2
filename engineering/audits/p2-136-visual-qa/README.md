# P2-136 visual QA evidence

**Result:** fallback component visual QA passed; trusted in-app route QA remains unavailable and is not represented as passed.

## Scope and safety

The production `ConsistencyPage` component was rendered through the admin Vite
app with deterministic, read-only API fixtures matching the dedicated-stack
observation and automated component contract. The fixture returned only the
existing consistency and CRM-integrity response shapes.

No server, MongoDB, Neo4j, ChromaDB, graph mutation, repair, constraint/index
apply, production environment, or external communication was used. The rendered
surface contains no repair, apply, delete, or merge control.

## Evidence

- `desktop-1440x900.png` — desktop topology metrics and traversal table.
- `tablet-768x1024.png` — tablet layout.
- `mobile-390x844.png` — mobile layout.
- `small-mobile-360x800.png` — small-mobile layout.
- `reflow-200-percent.png` — 200% reflow equivalent.
- `browser-results.json` — report-only control, data, overflow, and console checks.

## Observed result

- The surface is explicitly titled **Neo4j Topology Integrity · Report Only**.
- The report-only policy is visible.
- The dedicated-stack counts are represented: 2,527 nodes and 18,057 relationships.
- Coverage is 41/41 with zero findings and zero degraded traversals.
- No repair, apply, delete, or merge button is present.
- The dense traversal table uses its bounded horizontal scroll container on
  narrow screens; the page itself has no horizontal overflow.
- Browser console errors: `0`.

## Remaining gate

The Codex trusted in-app browser execution surface was unavailable in this
session. These screenshots are real fallback browser evidence against the
production component, but they are not trusted in-app route evidence. P2-136
remains partial until Kevin specifically accepts this fallback evidence (or a
trusted route pass is later captured) and supplies merge authority.
