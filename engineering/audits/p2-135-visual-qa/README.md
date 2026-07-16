# P2-135 visual QA evidence

**Result:** fallback component visual QA passed; trusted in-app route QA remains unavailable and is not represented as passed.

## Scope and safety

The production `KnowledgePage` component was rendered through the admin Vite app with deterministic, read-only API fixtures. The fixture returned the same metadata-only source/version, status, integrity, and preview shapes covered by the P2-135 automated tests. It rejected every request outside status, source listing/detail, and read-only preview.

No server, MongoDB, Neo4j, ChromaDB, correction record, index, production environment, external communication, Apply action, Retry action, or Rollback action was used. The exact-confirmation field remained empty and **Apply governed correction** remained disabled.

## Evidence

- `initial-desktop-1440x900.png` — metadata-only list before source selection.
- `preview-desktop-1440x900.png` — selected source, replacement/reason fields, content-bound preview, and disabled Apply control.
- `preview-tablet-768x1024.png` — tablet layout.
- `preview-mobile-390x844.png` — mobile layout.
- `preview-small-mobile-360x800.png` — small-mobile layout.
- `preview-200-percent-reflow.png` — 200% reflow equivalent.
- `browser-results.json` — fail-closed control state and console result.

## Observed result

- Source rows expose title, version, lifecycle, domain/language, and shortened digest only.
- The selected version remains readable without exposing unrelated source content.
- The preview states **no live mutation yet** and identifies Mongo, Neo4j, Chroma, Resource Catalog, GraphRAG, and rollback target.
- The mutation control remains disabled until the exact confirmation contract is entered.
- Desktop and responsive layouts retain readable hierarchy with no visible overlap or horizontal clipping.
- Browser console errors: `0`.

## Remaining gate

The Codex in-app browser connection failed during initialization in this session. These screenshots are therefore real fallback browser evidence against the production component, but they are not trusted in-app route evidence. P2-135 remains partial until Kevin specifically accepts this fallback evidence (or a trusted route pass is later captured) and supplies merge authority.
