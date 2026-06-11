# Graphify Piece Summary

Project: `momentum-creation-system-v2`

Built in pieces on 2026-06-11, then merged into the root graph.

## Piece Runs

| Piece | Path | Nodes | Edges | Communities | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Team app | `apps/team` | 334 | 499 | 14 | Cockpit, CRM UI, invitations, ScriptMaker UI, Ivory, leadership. |
| Prospect app | `apps/com` | 140 | 169 | 16 | Prospect-facing replicated pages and presentation flow. |
| Admin app | `apps/admin` | 233 | 447 | 13 | Admin dashboard, BA/prospect oversight, reports, broadcast surfaces. |
| Server | `server` | 1042 | 2670 | 41 | API routes, domain logic, Gateway/DB writes, CRM, invitations, tokens. |
| Packages | `packages` | 309 | 307 | 11 | Shared types and reusable package code. |
| Docs | `docs` | 42 | 36 | 14 | Build docs, printable cockpit workflow, route inventory, design docs. |
| Assets | `assets` | 5 | 0 | 5 | Image asset corpus. |

## Merged Graph

- Nodes: `2105`
- Edges: `4128`
- Communities: `124`
- Main graph: `graphify-out/graph.json`
- Interactive view: `graphify-out/graph.html`
- Report: `graphify-out/GRAPH_REPORT.md`

## Neo4j Import

Imported into Neo4j with the following project-scoped shape:

- `(:GraphifyProject {id: "momentum-creation-system-v2"})`
- `(:GraphifyNode {project: "momentum-creation-system-v2"})`
- `[:GRAPHIFY_REL {project: "momentum-creation-system-v2", relation: "..."}]`

Verified import counts:

- Neo4j nodes: `2105`
- Neo4j edges: `4128`

## Estimated LLM Usage From Piece Extraction

- Team app: `527` input / `166` output, about `$0.0005`
- Prospect app: `47,707` input / `389` output, about `$0.0197`
- Admin app: `529` input / `166` output, about `$0.0005`
- Docs: `217,517` input / `5,605` output, about `$0.0960`
- Assets: `69,650` input / `314` output, about `$0.0284`
- Server and packages were code-only AST extraction.

Approximate total for semantic extraction: `$0.1451`.
