# DESIGN TOKEN AUTHORITY — Team Magnificent (.com + .team)

**Status:** Authoritative. Read before any styling, restyling, scene brief, or page-build work on either app.
**Written:** 2026-09-06 · from Kevin's rulings of Sep 1–6 (rulings log: `momentum-creation-system-v3/.logs/ORCH_COM_RULINGS_20260831.md`, entries 1–8 of the 09-06 tail)
**Supersedes:** the 2026-08-15 edition of this file (near-black ground + warm cream copy, Bebas Neue / DM Sans). Kevin rejected cream on 2026-09-06 and lifted the floor the same day. Nothing from that edition's palette or type ships.
**Scope:** the .com (prospect tour, four pages + arrival screen) and the .team (member cockpit). One visual language, two postures — see §6.

---

## 1. THE WORLD IN ONE PARAGRAPH

Professional tech — modern, clean, interesting. A deep royal blue that lifts into turquoise, never near-black (Kevin, on Linear: "way too dark… I could not distinguish much of the background contrast"). Gold is identity. Teal is live. Copy is white and it is always readable — the scene may move, the words never fight it (Kevin, on Igloo Inc: "it defeats the purpose if people cannot read the message we are proclaiming"). Big clean type, glass cards, gradient grounds with rendered scenes behind the copy on the .com; the same ground and cards with no scenes on the .team.

Reference set Kevin reacted to (2026-09-06): Linear (style yes, floor too dark), Igloo Inc (motion and background yes, lettering unreadable), Apple Vision Pro, NVIDIA RTX, Runway, Lusion, Raycast, Resend. The floor-lift strip he approved: band B of `com-floor-lift-strip.html` — "I like the coloring much better."

---

## 2. THE AUTHORITY CHAIN

| Rank | Source | Governs |
|------|--------|---------|
| 1 | this document | the tokens, the roles, the legibility rule |
| 2 | `packages/shared/src/brand.ts` + `brand.css` (v2) | machine mirror — must be updated to match this file before any page-build lane starts (open item, see §9) |
| 3 | `design/com-design-candidates/holding-tank-four-pages-spec-20260904.md` (v3) | the copy — verbatim, approved, revised only in the final-revision pass |
| 4 | `D:\Kevins_Konga_line_Project\kevins-konga-line-north-star-v3-LOCKED.md` | Konga Line behavior (vertical conveyor, pinned YOU node, arrivals at the bottom, joins exit upward) — behavior only, not color or type |

If a hex value is not in §3 it is not a token. Do not introduce colors. Extend this file first, then brand.ts, then consume.

---

## 3. THE PALETTE

### Ground — the royal-to-turquoise gradient (band B)

| Token | Value | Where it sits |
|-------|-------|---------------|
| `--royal-900` | `#0F1B4D` | deepest corner; top of the .com flight; nav rail on the .team |
| `--royal-700` | `#1A2B6E` | gradient start (top-left) |
| `--royal-500` | `#1F5FA8` | gradient middle — the working ground; most body copy lives here |
| `--turq-500` | `#14A3B6` | gradient end (bottom-right) — atmosphere, never a text ground on its own |
| `--teal` | `#2DD4BF` | LIVE / action / progress — dots, CTA fill, YOU row, progress fills (unchanged from the prior edition) |

Canonical ground: `linear-gradient(160deg, var(--royal-700) 0%, var(--royal-500) 55%, var(--turq-500) 100%)`.
Per-page hue shift (Sep 1 ruling, "per-act hue shift yes"): the stops slide, the recipe does not — page 1 leans royal, page 3 (product) leans turquoise, pages 2 and 4 sit in between. Upper bound for any shift is band C (`#2350B4 → #2F8FD8 → #3AC8C8`); do not go brighter than C, do not go darker than `--royal-900`.

### Identity and ceremony

| Token | Value | Role |
|-------|-------|------|
| `--gold` | `#E8C36A` | IDENTITY — the prospect's number, her pinned node, the wordmark, ownership. Lifted from `#C9A84C` so it holds ≥ 7:1 on `--royal-700` |
| `--gold-bright` | `#F5C030` | CEREMONY — join celebration, milestone, arrival flash. Rare |

### Copy and surfaces (white, not cream)

| Token | Value | Role |
|-------|-------|------|
| `--white` | `#FFFFFF` | primary copy, headlines |
| `--white-mute` | `rgba(255,255,255,.84)` | supporting copy |
| `--white-faint` | `rgba(255,255,255,.62)` | meta, city/state, timestamps |
| `--line` | `rgba(255,255,255,.18)` | hairlines, card borders |
| `--glass` | `rgba(255,255,255,.08)` + `backdrop-filter: blur(14px)` | cards, the legibility plane |
| `--scrim` | `linear-gradient(180deg, rgba(15,27,77,0) 0%, rgba(15,27,77,.55) 40%, rgba(15,27,77,.55) 60%, rgba(15,27,77,0) 100%)` | the quiet ground laid behind a text block that sits directly on a scene |
| `--on-teal` | `#062A28` | text on a teal fill (CTA label) |

### Semantic roles — use these names in code, never the raw colors

```
identity  → gold          who she is; her number; the mark
ceremony  → gold-bright   join, celebration, milestone
live      → teal          real-time truth, SSE-driven state, the YOU row
action    → teal          the one button on a screen
progress  → teal          motion toward the webinar / launch
ground    → royal gradient
surface   → glass         cards, rails, the plane words sit on
copy      → white
```

Gold and teal never blend and never swap. One teal action per screen. Gold appears where it means something (Raycast discipline) — if a screen has gold in more than three places, remove one.

---

## 4. THE LEGIBILITY RULE (governing, Kevin 2026-09-06)

1. Every text block has a quiet ground. Either it sits on `--royal-700`/`--royal-500` with no scene detail behind it, or it rides a `--glass` plane, or a `--scrim` is laid between it and the scene. Never white type straight onto a lit or moving scene.
2. Contrast floor: headlines ≥ 4.5:1 and body ≥ 4.5:1 against whatever is actually behind them, checked on the busiest frame of the flight, not the calmest. `--white` on `--royal-500` ≈ 6.4:1 (passes). `--white` on `--turq-500` ≈ 3.1:1 (fails for body; headline only, and only over a scrim).
3. The scene may move; the text does not. During the .com flight, copy is pinned and the world moves behind it (Apple Vision Pro / Igloo posture), and the scene dims 40–55% within the text block's bounding box.
4. Rendered scenes stay BEHIND the copy — depth and atmosphere, never clutter (Sep 6 ruling 3). Scene brightness peaks away from text; scene briefs specify a "quiet zone" matching the text block's position on each beat.
5. `prefers-reduced-motion`: scene freezes to a still, scrim stays, nothing else changes.

---

## 5. TYPOGRAPHY

| Token | Family | Use |
|-------|--------|-----|
| `--font-display` | Sora, 600 | headlines, the position number, countdown values. Tight tracking (−0.02em), line-height 1.05 |
| `--font-body` | Inter, 400 / 500 | all running copy, card labels, nav. Line-height 1.6, measure ≤ 44ch on the .com, ≤ 70ch on the .team |
| `--font-mono` | JetBrains Mono, 400 | telemetry numerals and timestamps only, tabular nums |

Sentence case everywhere. No uppercase-tracked eyebrows, no ALL-CAPS labels, no single-word color accents inside a headline — the whole headline is white; the number is gold. Type scale (.com): display 60 / 48 / 34 desktop, 44 / 34 / 28 mobile (heavier mobile headlines, Sep 1 ruling); body 18; meta 14. (.team): display 32 / 24 / 20; body 15; meta 13.

Dropped from the prior edition: Bebas Neue, DM Sans, DM Mono, and the D-23 leftovers (Orbitron, Poppins, Spline Sans Mono) — the Google Fonts import in `apps/com/src/main.css` must be replaced with Sora + Inter (+ JetBrains Mono) in the same PR that updates brand.css.

---

## 6. TWO POSTURES, ONE LANGUAGE

| | .com (prospect tour) | .team (member cockpit) |
|---|---|---|
| Ground | royal gradient + Higgsfield-rendered scene behind the copy, per-page hue shift | royal gradient only — NO scenes, no flight, no welcome cinema ("just an interesting, clean design") |
| Motion | the scroll-world flight, seen once on arrival; Konga conveyor; live pulses | Konga conveyor; live pulses; section rise on load. Nothing else |
| Type | display-led, one idea per screen | body-led, dense, scannable |
| Cards | glass, 18px radius, 26px padding | glass, 12px radius, 16px padding; bordered rows for lists, not card grids |
| Nav | four-page switcher: left rail desktop, bottom bar mobile; Sign in / Sign out | left rail on `--royal-900` |
| Gold | the number, the mark, the sponsor's name | the member's name, rank, the mark |
| Teal | one CTA, the YOU row, live dots, countdown | live dots, progress fills, primary action |

---

## 7. MOTION

| Name | Spec |
|------|------|
| `tm-rise` | 620ms `cubic-bezier(0.2,0.7,0.2,1)`, fade + 0.75rem translate. Section arrival only |
| `tm-live-pulse` | 2s ease-in-out infinite, teal ring. Live indicators only |
| `tm-konga` | the vertical conveyor, 28s linear, arrivals surface at the bottom, front at the top, pause on hover |
| `tm-flight` | .com arrival only: scroll-driven scene flight, copy pinned, scrim tracks the text block |
| `tm-ceremony` | join moment: gold-bright flash + rise, ≤ 1.2s, once |

Stagger `0.10s / 0.30s / 0.55s / 0.80s`. Every new motion ships with its reduced-motion fallback in the same commit.

---

## 8. THE KONGA SURFACE ON THIS PALETTE

| Element | Role | Token |
|---------|------|-------|
| the prospect's number | identity | `--gold`, `--font-display`, 72px desktop / 56px mobile |
| her pinned row | live | `--teal` text, `--glass` row highlight |
| arrivals at the bottom | live | small teal pulse |
| join at the front | ceremony | `--gold-bright`, `tm-ceremony` |
| names | copy | `--white`; city/state `--white-faint` |
| card | surface | `--glass`, `--line` border, "Your Konga Line — live" header with teal dot |
| webinar countdown | live | teal-bordered 4-up, the only countdown on the surface |

Behavior authority stays the north-star v3 LOCKED spec. Copy authority stays the four-pages spec. Visual authority is this file.

---

## 9. OPEN ITEMS (must close before page-build lanes start)

1. `brand.ts` / `brand.css` still carry the Aug 15 values — rewrite to §3, §5, §7 and replace the font import. One PR, both apps consume it.
2. Logo NOT cemented (Sep 1 brief: magnificence, team formation, momentum, success; electric high-tech; holographic or chrono-brass). The wordmark sits in `--gold` until a logo is ruled.
3. Admin surface: whether it consumes brand.css is unverified. Out of scope for this pass; it inherits the tokens when it does.
4. Kevin reacts to real screens; this file is held loosely until the first Your-position screen is ruled on.
