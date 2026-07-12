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
