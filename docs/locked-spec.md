# Locked Spec

This file is the authoritative reference for what the Momentum Creation System is and how it behaves. It is sourced from **Chat #82** and **Chat #84** between Kevin L. Gardner and Claude on 2026-05-14, plus the system-prompt brief that opens every working session.

When this file disagrees with the codebase, this file wins.

## What it is

The Momentum Creation System is an independent operational tool. **It is not a THREE product.** It is not a back-office clone. There are three entities and they do not blur:

- **THREE International** owns enrollment, compensation, and payouts.
- **The Momentum Creation System** (this codebase) owns invitation, replicated presentation, prospect dashboard, training, BA cockpit.
- **Team Magnificent** is the human organization that bridges both.

This separation is the compliance foundation.

## The pool mechanic

Every Brand Ambassador places their prospects into one shared collective pool that the entire team sees. There is one pool, not one-per-BA. Every BA's recruiting feeds the pool every prospect sees.

Position in the visible team line is **monotonic**. Position numbers do not reshuffle. Position is timestamp-anchored to the prospect's entry into the team's growth, which happens at `video_complete`.

Enrollments resulting from pool entries distribute spillover through THREE's binary structure — but the marketing layer (this system) never names that mechanism on `.com`.

## Two-stage placement

A prospect arrives at `/p/{token}` via the BA's SMS invite.

**Stage 1 — pre-`video_complete`:** they see the BA's replicated presentation site, branded to that BA. Dr. Dan's video. Research dossier. The BA's name and face. The page is personalized to both the prospect and the inviting BA — it names the prospect, it names the BA, throughout. It is never anonymous on any section.

**Stage 2 — post-`video_complete`:** at the moment the video completes, the system silently places them in the team-wide holding tank pool and switches their view to the prospect's replicated dashboard — their position in the team line, their "behind you" counter climbing in real time, the six-section locked design. The dashboard is also personalized — it names the inviting BA in the Arrival section, in the position card, and in the callback CTA.

The two stages share one URL. The state transition is invisible to the prospect.

## The six-section prospect dashboard (locked Chat #82)

The dashboard renders in this order. Order is locked.

1. **Arrival** — you're here, you're in. Position number. Sponsor card (the BA who invited).
2. **Opportunity** — the market scope. $200B GLP-1 market by 2033. 72% of US adults overweight. The product is acknowledged because the video already did the work.
3. **Mechanic** — the Power of 2 and 2 in 72. Compliance-safe structural mechanic, never income, never placement promise.
4. **Live Place** — the prospect's position, the people ahead, the people behind and climbing in real time. Live ticker. Vertical movement tape.
5. **TM Advantage** — the team-wide pool framing. One operating system. Shared visibility. Not a comparison to other teams — a statement of how this team operates.
6. **Real Conversation** — the closer. Headline in Kevin's exact words: *Let's have a real conversation about this unfolding new opportunity.*

The only explicit form action is *I want [BA] to call me ASAP* with three intent radios capturing what the prospect is thinking. Submitting it is the conversion signal.

A 72-hour Zoom or webinar event is shown on the dashboard so closure has a deadline.

## Brand isolation on `.com`

Locked 2026-05-17. The `.com` surface carries **Team Magnificent branding only**.

No THREE International logo. No THREE International name in any eyebrow, header, navigation, or footer. No "independent operational team inside THREE International" disclaimer. No "independent promoter tool" language anywhere. The prospect sees one brand on the prospect-facing surface: Team Magnificent.

Dr. Dan's credential appears on the presentation page as **Chief Scientific Officer and Chief Formulator** with his credentials (Caltech PhD, 16 patents, 70+ supplements formulated, 1.3M followers, top-50 podcast). The card does not name his employer. The credentials speak for the science.

The compliance disclaimer on `.com` reads in Team Magnificent's voice only: *"Queue positions and momentum displays demonstrate team activity in real time and do not guarantee any final placement, compensation, or earnings outcome. Market figures cited from public sources are for context only. This page contains no income claims, placement promises, or guarantees of any kind."* No mention of THREE.

THREE International references stay where they are operational:

- Inside `.team`, the BA needs to know their THREE BA ID, log into THREE's back office, and reference THREE's comp plan in training. Those are operational data, not branding.
- Inside `/admin`, genealogy reconciliation against THREE's records stays as the Kevin-only operational tool.
- In the internal design docs (this folder), THREE references stay as architectural descriptions of how the system actually works.

The rule is about the prospect-facing surface only. It does not change the architecture — THREE still owns enrollment, compensation, and the binary. The BA still walks the prospect into THREE off-app after the human conversation. That step is not marketed on `.com` because it does not happen on `.com`.

## Personalization on `.com`

Locked 2026-05-17. The `.com` surface is **never anonymous**. Every page the prospect sees is personalized to both the prospect and the inviting BA.

- The presentation page hero names both: "[Prospect first name], you were personally invited by [BA full name]."
- The presentation page body copy names the inviting BA throughout, in the inviting BA's voice.
- The Part 4 bridge-to-team section may name the inviting BA again as the human voice behind the invitation.
- The dashboard Arrival section names the inviting BA in the "Invited by" line.
- The dashboard position card names the inviting BA in the "Held in [BA]'s leg" copy.
- The dashboard Section 6 callback CTA names the inviting BA in the headline and the action button.
- The ticker strip may reference the inviting BA as part of the moment-reinforcement messages.

Both interpolations are server-side at page render. The token resolves the prospect record (for the prospect's first name) and the inviting BA record (for the BA's full name). The page is never shown without both.

This rule does not contradict the compliance rules above. The page names the inviting BA as the human who invited the prospect — it does NOT claim the inviting BA will be the prospect's binary sponsor in THREE. That decision happens off-app at enrollment time, per the team's placement strategy.

## Sponsor immutability

Locked. Kevin's words: *“in our domain everyone is connected to the correct people and there are no strays.”*

The sponsor BA is captured at the moment the invite token is minted and stamped onto every artifact downstream — the prospect record, every activity event, every pool entry, every callback request. It is **never recomputed**. Even if the BA's own sponsor changes upstream, the prospect's sponsor stays locked to the BA who invited them.

Any route that accepts `sponsorBaId` as input must reject the input and use the token-derived value instead. Any update path that touches `sponsorBaId` must be blocked at the type, route, and audit-log level.

## BA-to-BA enrollment (not programmatic)

When the prospect decides to enroll, the BA walks them into THREE through THREE's own tools, off-app, BA-to-BA. **The system has no programmatic registration handoff to THREE.** No registration routes. No registration handoff state machine. Enrollment happens between two humans using THREE's official interface.

After the human conversation and the off-platform enrollment, the BA returns to their cockpit and marks the prospect as enrolled. The system generates an access code the BA gives to the new BA, who uses it to enter `.team`.

## The 8-week flush

The holding tank record flushes when the prospect enrolls or when the 8-week consideration window expires. After flush, the prospect's position no longer appears in the live line. Monotonic position numbers for prospects above and below them are preserved — the flushed slot becomes vacant, but no one renumbers.

## Compliance — never on `.com`

The marketing layer shows reality without making promises. The compensation layer operates inside THREE's regulated structure. The two never overlap on prospect-facing surfaces.

**Never on `.com`:**
- Income claims or earnings projections
- Placement or queue-position-equals-leg-position promises (queue position is timestamp order in the pool; THREE's binary leg position is something else entirely — they are not the same and must not be conflated)
- AI prospecting (Michael is BA-facing only)
- Compensation cycle math, volume math, or rank math
- A current head count of the team (the 100,000 goal is named, the current count is not)
- Direct comparison to other teams or other companies

Kevin's locked frame: *“it shows really how it works, and people are signing up.”*

## Michael

Michael is an outbound voice agent (Telnyx-based) that interviews each new BA during onboarding, captures the transcript and scoring, and feeds the results back to the BA's record and their upline's cockpit.

Michael is not a chat agent. Michael is never prospect-facing. Michael never appears on `.com`.

## Communication

- **Telnyx** for SMS to BAs (callback alerts and signal events)
- **Email provider TBD** (Resend, Postmark, SendGrid, or SES — pick when wiring)

## Persistence

Every write hits **MongoDB + Neo4j + ChromaDB** in the same operation, via the Universal Gateway at `localhost:2525`. No store is optional. No store is deferred.

## Brand

- Ink: `#0A0A0A`
- Gold: `#C9A84C`
- Gold-bright: `#F5C030`
- Teal: `#2DD4BF`
- Cream: `#F5EFE6`
- Display: Bebas Neue
- Body: DM Sans
- Mono: DM Mono

The `.com` site feels alive. Animation is the demonstration, not decoration. The `.team` site is quieter — content, training, operational tooling.

## Reference conversations

The two transcripts in the original chat project knowledge base define the architecture. When this file is unclear, those transcripts are the deeper source:

- **Chat #82** — prospect dashboard six-section design, compliance, sponsor immutability, build sequence
- **Chat #84** — pool mechanic, two-stage placement, spillover, visibility breakthrough, product moment, year of evaluation, replicated site vs replicated dashboard, flush mechanic, communication infrastructure, Michael
