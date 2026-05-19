# Locked Dashboard Prototype — source reference

This file references the locked HTML prototype Kevin uploaded on 2026-05-14 in Chat #82.

- **Source file**: `dashboard-prototype.html` (uploaded by Kevin, 50,959 bytes, md5 `2a214eea86fdb1309bbb74c6b125adc6`)
- **Chat**: #82 (today)
- **Authority**: This is the locked design. When the React components in `apps/com/src/components/dashboard/` disagree with this prototype, the prototype wins.

The prototype lives outside the repo because it was uploaded to the conversation as a working session artifact, not committed to disk as a build asset. Its content has been transcribed into the React components directly.

## Structure (in order)

1. **Ribbon** — sticky top bar with brand mark and `Live · holding tank` pulse
2. **Section 1 Arrival** — `Invited by [BA]` line, headline "You saw it. You're in.", sub paragraph, position card (3-col grid: position number / "Held in [BA]'s leg" copy / placement timestamp)
3. **Section 2 Opportunity** — headline "This isn't a small room.", lead, 4-cell market grid: $6.8T global wellness (GWI 2025), $200B GLP-1 alts by 2033 (industry projection), 72% Americans overweight (CDC 2024), $1,200/mo synthetic cost (avg retail 2025)
4. **Section 3 Mechanic** — headline "Two people. Then they find two.", lead, DOM cascade (7 rows: 1 → 2 → 4 → 8 → 16 → 32 → 64, lit in sequence with markers like "1 leader", "2 builders", "4 builders"...), then "The math points here → 100,000 Qualified Brand Ambassadors", then three named principles (Power of 2 / 2 in 72 / One bite at a time)
5. **Section 4 Live Place** — headline "The team is forming around you. Right now.", lead, 2-col board: counters (Ahead of you / Behind you · live with pulse-dot and counter value) on the left, live stack list on the right with `#pos`, name, time-ago entries that age and trim (keep ~9 visible)
6. **Section 5 TM Advantage** — headline "We work together. With the same goal.", lead, Kevin's quote ("We've harnessed the power of our team using technology so we're working together with the same goal — to win."), mission board with 100,000 target and mission-philosophy paragraph, pool grid (4 stats: 47 active BAs, 213 invitations, 89 placements, +38% velocity), compounding closer copy ending in "Built to win. Built to win together."
7. **Section 6 Next Move** — headline locked from Chat #82: "Let's have a real conversation about this unfolding new opportunity.", lead, 2-col CTA grid: (a) real-conversation-with-BA card with 3 radio reasons (interested / ready to join / specific questions), phone field, best-time field, gold submit "Yes — let's talk"; (b) webinar card with 23h headline, event-when (Tuesday · 7pm PT · Zoom), event-hosts (Kevin and Paul), countdown (days/hours/min/sec), name + email fields, teal submit "Reserve my seat"
8. **Footer** — Team Magnificent mark, 2 brand lines, compliance disclaimer paragraph

## Animations referenced

- `rise` keyframe (opacity 0 + translateY(20px) → 1 + 0) on arrival elements with staggered delays
- `pulse` keyframe on the ribbon dot and the behind-you live indicator
- `nodeAppear` keyframe on cascade nodes with staggered animation-delay
- `.lit` class added to cascade rows on a 220ms-stagger timer
- Live stack: items prepend `.fresh`, list trimmed to 9, time labels age on each tick
- Webinar countdown: ticks every 1s, wraps to a 72h cycle on rollover

## Colors and typography

Match the existing brand tokens in `packages/shared/src/brand.ts`. Prototype uses the same `--ink #0A0A0A`, `--gold #C9A84C`, `--gold-bright #F5C030`, `--teal #2DD4BF`, `--cream #F5EFE6` palette. Fonts: Bebas Neue (display), DM Sans (body), DM Mono (monospaced labels).
