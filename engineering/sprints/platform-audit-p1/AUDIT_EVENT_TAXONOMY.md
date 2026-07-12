# Unified Audit Event Taxonomy

All `mcs_audit_log` writes retain their existing namespaced `action`. P1-75 adds a derived, versioned taxonomy envelope; it does not rename historical actions or mutate historical records.

| Field | Values / meaning |
|---|---|
| `version` | `1` |
| `namespace` | First action segment: `admin`, `ba`, `system`, `vm`, `runtime`, etc. |
| `category` | `read`, `create`, `update`, `delete`, `lifecycle`, `security`, `delivery`, `governance`, `reporting`, `runtime`, `unknown` |
| `operation` | Remaining namespaced action segments |
| `impact` | `observation`, `mutation`, `destructive`, `control` |
| `outcome` | `succeeded`, `blocked`, `failed`, `queued`, `unknown` |
| `sensitivity` | `routine`, `sensitive`, `governance_critical` |
| `reasonRequired` | True for destructive or governance-critical events |

New writes persist taxonomy to Mongo and project category/impact/outcome into Neo4j and Chroma metadata. Reads derive taxonomy for older rows that predate P1-75, preserving append-only history.

The executable classifier is `server/src/domain/auditTaxonomy.ts`. Regression coverage is `server/src/domain/__tests__/auditTaxonomy.test.ts`.
