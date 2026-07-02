# Chat #85 — Decisions Locked

_Saved 2026-05-17_

## The standing rule, in Kevin's words

> "and it should never conflict with three international only mirror. if there is a conflict or dispute three international is the final authority"

THREE International is the **single source of truth and final authority** on sponsorship, enrollment, placement, and compensation. Team Magnificent records mirror THREE for operational visibility — never compete, never override. If our record ever differs from THREE's, we update ours to match.

## Admin access

Kevin only. Not Paul. Option 1 locked in: hardcoded environment variable matched against Kevin's BA ID. Hard 403 at middleware on `/admin/*` for any other BA. Paul logs in as a regular BA and sees a regular cockpit. To grant access to another BA later, redeploy with the env var set to multiple IDs.

## Powerline mechanic, adapted to THREE's binary

Kevin adapted the Power-Leg-Concept's placement-discipline visualization to THREE's binary. The binary structure is unbroken — THREE handles actual placement and compensation per its plan. What Team Magnificent adds is the visualization layer.

On `.com`, every prospect sees **one huge growing team leg** — a generic demonstration of team momentum, fed by every BA's recruiting activity across Team Magnificent. The visualization shows arrivals and growth as the team reaches out. It does not show binary leg structure, does not show actual placement, does not show sponsor identity, does not show compensation flow.

Actual binary placement happens off-app at enrollment time. The inviting BA decides which leg (left or right) the new BA enters in THREE's tools, per the team's strategy. Once the new BA joins, their own legs start growing, and spillover happens per THREE's binary rules.

Everyone in Team Magnificent is in Kevin's downline. Each BA builds two legs (binary standard). Paul is at the top of Kevin's structure as an upline figure operationally; he builds primarily into Kevin's left leg because his right leg already has thousands of people through Lance and Tracie Smith. The `.com` visualization is generic — it doesn't name sponsors, doesn't claim placement positions, doesn't make promises.

## BA cockpit scope on `.team`

Stripped of all genealogy except one thing:

1. **My Sponsor card** — name + phone + Send Message button. No photo, no email. For code-derived sponsors (every normal BA), pulled from the access-code owner's BA record. For founders (Kevin and Paul), manually overridden on their profile.
   - Kevin's card: My Sponsor = Paul Barrios + Paul's phone
   - Paul's card: My Sponsor = Lance and Tracie Smith + their phone
2. **My Invites** — full list of personally invited prospects with status pipeline (link minted → clicked → video started → video completed → in holding tank → callback requested → webinar reserved → enrolled → expired)
3. **CRM per invite** — activity timeline, notes, follow-up reminders, tags, prospect contact info, dispositions, re-invite option

Nothing else genealogy-related on `.team` for regular BAs. THREE already shows downline/team/binary/volume/rank. Duplicating any of that would create drift and confuse compliance.

Full team genealogy mirror lives only on `/admin` — Kevin's operational tool, not BA-facing.

## Replication model (corrected this chat)

- **`.com`** — solely for prospects to see. Shows the holding tank, the powerline FOMO mechanic, the live team momentum. Operationally per-BA (callback routes to inviting BA) but does not name the sponsor or claim placement.
- **`.team`** — replicated per BA for that BA's own use. Each BA logs in and sees their own scoped view: their cockpit, their invitation generator (mints their `/p/{token}` links), training scoped to their progress.

## Files produced this chat

- `Team-Magnificent-Signup-Architecture.docx` (22,467 bytes) — text-only with the THREE-final-authority Standing Rule callout, Section D.3 rewritten as 'a mirror of THREE International's records'
- `Team-Magnificent-COM-Design.docx` (24,617 bytes) — full prospect-facing surface design, 8 sections (A–H), including the locked six-section dashboard and the powerline-adapted-to-binary mechanic
- `build-com-design.cjs` — the build script for the .com design doc, kept for regeneration

## On the horizon

- `.team` design document — login, signup (already in Signup & Architecture), welcome, Michael interview UI, Fast Start Guide, 10-step orientation, invitation generator, BA cockpit (per scope above), replicated .com preview, profile/settings
- `/admin` design document — Kevin-only. Code generator, code management, full team genealogy mirror, discrepancy review against THREE, BA list, holding tank cross-team view, Michael transcripts, audit log
- Excalidraw integration not yet exercised — Kevin confirmed it's available via universal-external tooling; future diagram regeneration goes there
- Existing `momentum-creation-system` repo (10 commits of wrong-shaped earlier build) decision: salvage / archive / delete

## Open questions carried forward into Section H of the COM design

1. Inviting BA naming on the presentation page (named vs anonymous)
2. Final copy for the presentation page (Kevin to write)
3. Webinar timing and cadence (weekly Tuesday vs every-72-hours conflict)
4. Email provider choice (Resend, Postmark, SendGrid, AWS SES)
5. Position stack city/state granularity (IP geo, BA-supplied, inviter's region)
6. Behind-you counter update interval (SSE vs short-poll)
7. Expired token auto-renew behavior
8. Holding tank flush window (adaptive vs fixed 8 weeks)
9. Position stack max visible entries (5/10/20)

## Failure modes avoided this chat

- Auto-generating clarifying-question menus with options Claude itself authored (chat #83 failure mode). Avoided.
- Treating the existing presentation page HTML as locked compliance source. Flagged the issues and treated it as a working sketch instead.
- Overthinking the powerline visualization as a specific binary-leg view. Corrected when Kevin clarified: it's a generic demonstration of one huge team leg, no placement claims.
- Pushing through a corrupted base64-transfer pipeline. When the first attempt produced a 168-byte-corrupted docx, switched to plain-text chunking which worked.
