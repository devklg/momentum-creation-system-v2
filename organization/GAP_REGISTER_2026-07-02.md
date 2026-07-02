# MCS V2 — Gap Register (Kevin's critical-missings session)

Opened: 2026-07-02 · Authority: Kevin L. Gardner · Recorded live by Claude

Status: OPEN — capture-first register. Gaps land here as Kevin surfaces them;
triage against the production board happens after the list settles. Same
discipline as SCHEMA_REVIEW_RULINGS_2026-07-02.md.

---

## GAP 1 — Member replicated site (the public half of member presence)

**Kevin's statement of the gap:** the member has his own self-contained
replicated site with cockpit, agents, et al — e.g. `kevin.teammagnificent.team`.
His `.team` site creates his `.com` prospects (his own video presentation);
his prospects land in the holding tank attributed to him. Includes the VM/RVM
app **if Kevin grants access** (see Gap 2).

**Architecture ruling (Kevin, 2026-07-02): LOGICAL replication — confirmed (a).**
One platform; every member's presence is stamped out under their own identity.
NOT physical per-member deployments. The prospect-facing pool remains the ONE
team-wide holding tank (locked spec §1.12 / §3.2 unchanged): a member's "tank"
means his ATTRIBUTED SLICE of the shared pool — his cockpit filters to his
prospects; the prospect-facing dashboard shows team-wide momentum. Every
member's replicated site therefore inherits the whole team's momentum from
day one; attribution (sponsorTmagId) differs, the demonstration is shared.

**What already exists (private half):** scoped cockpit, Steve/Michael/Ivory
per-member context, token minting, CRM — all keyed to tmagId.

**What is missing (the build):**
1. **Subdomain scheme** — `{slug}.teammagnificent.team` per member: wildcard
   DNS + wildcard TLS + host-based member resolution middleware. Slug =
   DNS-safe unique member label, minted at provisioning, collision-handled,
   reserved-names list (www/admin/api/login/app/mail/…).
2. **Evergreen public presence** — the standing member page (bio-link
   durable): renders the member's replicated presentation experience and
   mints a token on visitor engagement. Sponsor immutability holds at the
   slug level: a visitor arriving via a member's site can never become
   another member's prospect.
3. **Provisioning ceremony** — at member signup, one atomic audited act
   stamps out the full presence: slug reserved → site live → cockpit
   initialized → agents armed → access code held. Defined, guaranteed,
   triple-stack audited.
4. **Schema surface** — `slug` (unique) on the member record;
   `tmag_member_sites` collection (photo, story, page content —
   compliance-validated at save per §3.11, since the public face is
   prospect-facing and all §3.8/§3.10 rules apply).
5. **Tenancy seam clarified** — `tenantId`/`teamKey` scaffolding remains the
   future seam for OTHER TEAMS; member replication is a different axis.
   One canon sentence to prevent conflation.

**OPEN RULING (Kevin) — surface doctrine for the subdomain:** a member's
replicated site serves PROSPECTS, but lives on `.team`, which the locked spec
defines as the regulated BA surface. Options: (a) subdomain = member's door
only, prospect-facing share links stay on `.com`; (b) one subdomain serves
both — public visitors get the §3.8-compliant prospect experience,
authenticated member gets the cockpit (amends the locked surface doctrine;
every never-on-.com rule then applies to the public faces of .team
subdomains); (c) parallel subdomains per domain (.com public / .team
private). Kevin's phrasing leans (b); NOT yet ruled.

**VERIFY:** `teammagnificent.team` domain registration status (record shows
`.com` at Namecheap; `.team` is load-bearing for this design and for the
locked spec's surface naming).

## GAP 2 — Member entitlement model (Kevin-granted module access)

**Kevin, 2026-07-02:** the VM/RVM app is part of a member's site **"if I let
them have access"** — module access is a Kevin-granted entitlement, not a
default. Today the schema gates VM at the campaign level
(`adminApprovedForLiveDelivery`) but has no member-level entitlement surface.

Needed: an entitlements field/collection on the member (first entitlement:
`vmAccess`; designed to grow — future modules), granted/revoked only from
`/admin`, audited, enforced at route + UI level. Connects to Ruling 13
(lead-ownership continuity — multiple members building with RVM under their
own ownerTmagId).

---

## Awaiting further gaps from Kevin (session in progress)
