# DECISION — Membership eligibility is enforced by access codes

- Status: **DECIDED (Kevin, 2026-07-01).** Resolves the "membership-eligibility enforcement" remaining item.
- Related: `DECISION_team_magnificent_membership_canonical_identity.md`, locked-spec Part 2 (THREE upstream), access-codes domain.

## The rule

To become a Team Magnificent member you must satisfy **both**:

1. **Be an enrolled III International Brand Ambassador** — captured as `threeBaId` (mirrored from THREE; never authenticates).
2. **Be in Kevin's downline / team** — proven by holding a valid **`TMAG-XXXX` access code** issued by an existing team member (your sponsor).

Being a III BA alone is **not** sufficient — membership requires the downline relationship, and the downline relationship is proven by the access code.

## The enforcement mechanism = the access code

The access code **is** the eligibility gate. There is no separate eligibility check to build — it is structurally enforced by how codes are issued and consumed:

- **Only Kevin mints codes** (from `/admin`). Every other code traces to a member who was themselves admitted by a code → the whole membership set is, by construction, Kevin's downline.
- **One code per member for life**, reused to sponsor everyone they bring in. Using a sponsor's code at signup **captures the sponsor immutably** and places the new member in the downline tree (`(:TeamMagnificentMember)-[:SPONSORED_BY]->(:TeamMagnificentMember)`).
- **No valid code → no membership.** Signup without a code (or with an inactive/unknown code) is refused. This is the enforcement.
- **THREE stays upstream.** The app mirrors the downline slice; it never enrolls into III and never overrides genealogy. BAs walk prospects into III off-app.

## What this means for the build

- The existing `access_codes` collection + code-gen + sponsor-immutability already carry this model; enforcement is **already the shape of the system**, not a new subsystem.
- The BA signup/redemption path must: require a valid active `TMAG-XXXX` code, derive `sponsorTmagId` from the code (reject any body-supplied sponsor), and record `threeBaId`. The one audited exception is Kevin's admin override.
- No programmatic III-enrollment verification handoff is added; `threeBaId` is a recorded attribute (Kevin's downline members are known to be enrolled III BAs by construction of how they got a code).

## Bottom line

Membership eligibility (III BA + in Kevin's downline) is enforced **by the access code itself** — mint authority + one-code-per-member + sponsor immutability make the member set exactly Kevin's downline, with `threeBaId` recorded as the III credential. No separate gate to build; the redemption path enforces "valid code required."
