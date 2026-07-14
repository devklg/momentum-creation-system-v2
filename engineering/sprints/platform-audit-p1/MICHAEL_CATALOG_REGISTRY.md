# Michael Catalog Registry

P1-62 exports two explicit registries from the controlled Michael response
catalog:

- `MICHAEL_RESPONSE_TYPE_REGISTRY` defines substantive versus safe response
  types and their allowed Context Packet scenario families.
- `MICHAEL_CATALOG_KEY_REGISTRY` maps every concrete EN/ES catalog key to its
  response type, scenario family, packet status, language, and safe/substantive
  classification.

Both are generated from or parity-tested against `MICHAEL_RESPONSE_CATALOG`.
They generate no text, perform no persistence, and activate no behavior.

## Language and fallback authority

`packages/shared/src/michael-language.ts` is the single source for Michael's
controlled EN/ES response copy, safe-path policy, and current English `.team`
runtime-card chrome. The fixture module imports its response copy, the selector
builds degraded/missing/failed/rejected mappings from its fallback policy, and
the card imports its UI copy. These consumers must not fork the wording.

The authority is versioned separately from the response-contract schema so a
future wording or fallback-policy review is explicit. Version `1.0.0` preserves
the existing controlled copy verbatim; it does not activate LLM generation or
change runtime permissions.
