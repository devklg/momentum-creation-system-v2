# Launch Center Product Boundary

Decision: **Launch Center is a named, first-run surface within `/cockpit`.** It is not a separate top-level route and not an informal umbrella label.

For a new Brand Ambassador, `/cockpit` renders the guided Launch Center: the next launch mission, Steve/Michael state, training progress, invitation action, and return path. As launch milestones are completed, the same `/cockpit` route matures into the operational cockpit and PMV view.

Existing implementation anchors:

- Team route: `apps/team/src/routes/cockpit.tsx`
- Launch component: `apps/team/src/components/launch/LaunchCenter.tsx`
- Server projection: `GET /api/cockpit/launch`
- Projection domain: `server/src/domain/cockpit.ts`
- UX authority: `docs/v2-redesign/MASTER_UX_IMPLEMENTATION_SPEC.md`

Consequences:

- Do not create `/launch-center` or a second navigation destination.
- “Launch Center” remains visible user-facing language during launch.
- Cockpit owns routing and lifecycle transition; training, invitations, profile, orientation, and CRM remain their own authoritative domains.
- Launch readiness describes completed actions and available next steps. It must not score, rank, classify, or predict a person.

## P2-96 conditional disposition

The “umbrella concept” branch is not applicable because P2-94 selected the named-surface branch. Cockpit, training, invitations, and CRM remain independent authoritative product domains; they are not renamed or subsumed under a Launch Center umbrella. The current read-only projection composes onboarding, training, and invitation evidence. Profile and CRM readiness join that projection in P2-97.
