# Steve Success Profile guidance projection

P2-118 connects the descriptive training and launch recommendations already
stored in a BA's Steve Success Profile to the existing Launch Center rail. The
projection is `steve_guidance.v1`.

## Source and scope

Guidance is available only when the authenticated BA has exactly one completed
`tmag_steve_success_interview` record and the stored profile `tmagId` matches
the session identity. Missing, duplicate, incomplete, or mismatched evidence
fails closed and exposes no recommendation text.

The projection copies only bounded `trainingRecommendations` and
`launchRecommendations`. It does not expose the transcript, primary why,
success vision, obstacles, communication preferences, or Michael handoff text.
P2-141 still owns the broader Steve privacy/minimal-exposure review.

## Guidance, not authority

Recommendation text is Steve-authored descriptive support context. It is not
Kevin-approved knowledge, curriculum, completion evidence, or a requirement.
Text order is preserved and no priority, weight, confidence, or readiness is
calculated. Unsafe generated copy is omitted. A stored link remains clickable
only when it exactly matches an implemented allowlisted Team route; otherwise
the text remains and its link becomes `null`.

Every BA keeps equal access to the same opportunity, tools, training, and
support. Guidance never changes route access, Fast Start order or prerequisites,
progress, completion, Launch Center steps, or its factual next action.

## Context Agent boundary

This is an ordinary read-only application projection. It does not place private
profile state into approved knowledge or a Context Packet, and it does not
claim that Michael's runtime consumes Steve context. Any future agent-runtime
connection must use a server-owned Context Manager provider under separately
approved governance. ACR-0010 remains proposed and no comparison or compiled
guidance record is persisted.

The existing sponsor training-support projection now reads the canonical Steve
recommendation-object and `potentialObstacles[]` shapes instead of its stale
local string/field aliases. It remains sponsor-authorized, read-only, and is
not evidence of Context Manager integration.
