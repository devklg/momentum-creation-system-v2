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

**RULED (Kevin, 2026-07-02) — surface doctrine:** **member = `.team` /
prospect = `.com`, and the `.com` is attached to the member.** The member's
self-contained site lives at `{slug}.teammagnificent.team` (cockpit, agents,
training — regulated surface). Everything the prospect touches stays on
`.com`, carrying that member's attribution (sponsorTmagId). The locked-spec
surface split (§3.1/§3.8/§3.10) is preserved unchanged — it simply gains a
member dimension, stitched by one slug → one sponsorTmagId across both
domains. Minor build-time detail left open: the FORM of the evergreen
prospect entry on `.com` (member subdomain vs `/m/{slug}` path vs
token-only) — attribution behavior is ruled regardless of form.

**VERIFIED 2026-07-02:** `teammagnificent.team` is registered (resolves to
Namecheap parking, 192.64.119.237) — ready for wildcard DNS at build time.

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

## GAP 3 — Printing (/admin + member CRM prospect list)

**Kevin, 2026-07-02:** printing in `/admin`, and a printable list of
prospects in the CRM.

Two surfaces:
1. **Member cockpit CRM → printable prospect list** — the working call sheet:
   name, city/state, disposition, follow-up due, last activity; filtered to
   the member's own prospects (scope = their attributed slice, per Gap 1).
   Print-formatted view (print CSS and/or PDF), member-initiated.
2. **`/admin` print views** — Kevin-side printable output for admin surfaces
   (member roster, prospects, reports — exact surface list to be enumerated
   at build).

3. **Agent-generated printables (Kevin, same session):** agents produce
   print-ready artifacts — Michael's daily to-do / success actions as a
   printable daily card, training tips as tip sheets, and the actual invite
   (ScriptMaker draft) as printed text. Natural extension: Steve's Success
   Profile printed by the SPONSOR as prep for the workbook call (the human
   conversation works from paper). Compliance holds automatically: invites
   are validated at draft time (§3.11 script-time enforcement), so printing
   outputs the already-compliant draft — print is a rendering, never a
   bypass. Ties to Ruling 8/12c: an agent template (the road) can DECLARE
   its printable outputs, making printables a first-class template property
   rather than per-feature bolt-ons.

Design notes:
- Printing is an EXPORT class — ties directly to the locked-spec Part 5 open
  decision “Export PII redaction — per-export confirmation always, or
  persistent show-me-everything preference for Kevin” (ADMIN J.5.10). That
  ruling should be made alongside this build; member-side prints are
  PII-bearing by nature (their own prospects' contact data — permissible,
  but audit-worthy).
- A CRM CSV export already exists in the design lineage (locked §4.4 note);
  print adds formatted output, not a new data path.
- Print events audit-logged (who printed what scope, when).

---

## Awaiting further gaps from Kevin (session in progress)
