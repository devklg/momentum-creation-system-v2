# Team Magnificent Brand Visual Review

Scope reviewed:
- `assets/logos/*`
- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `apps/com/src/main.css`
- `apps/team/src/main.css`
- `apps/com/tailwind.config.ts`
- `apps/team/tailwind.config.ts`
- `apps/com/src/routes/tm-prospect-dashboard/`
- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/ivory.tsx`
- `apps/team/src/routes/cockpit.tsx`

This review covers branding and visual identity only. No code changes were made.

## 1. Current Brand Weaknesses

### Team Magnificent is present, but not visually dominant

The code uses the words "Team Magnificent" in multiple places, but the visual identity rarely carries the screen. The strongest brand assets exist in `assets/logos/`, especially:

- `logo_dark_hero.png` - 1600x600, premium full signature.
- `logo_navbar.png` - 520x90, compact wordmark.
- `logo_icon.png` - 400x400, compass mark.
- `logo_dark_square.png` - 800x800, square brand lockup.
- `logo_light_print.png` - 1200x400, light/print wordmark.

Those assets are underused in the reviewed surfaces. The prospect dashboard uses a hand-built CSS compass mark in the ribbon and footer instead of the actual logo system. `welcome.tsx` uses `logo_icon.png`, but the top strip sets it at `h-7`, which makes the brand feel small. `ivory.tsx` and `cockpit.tsx` are text-only brand surfaces.

### The wordmark is missing where memory should be created

The full "Team Magnificent" wordmark should appear at major transition points:

- First screen after video completion.
- Top of the prospect dashboard.
- Footer close of the dashboard.
- First authenticated BA welcome.
- Cockpit home base.
- Ivory roster and generator.

Today, the brand often appears as small mono/display text. That reads as a label, not as an identity.

### The brand hierarchy is reversed in some places

On `welcome.tsx`, the page has strong emotional weight, but the top brand strip uses a small icon and small wordmark. The hero headline "WELCOME TO THE TEAM." dominates, while the formal Team Magnificent mark is secondary.

The welcome eyebrow says "Official Welcome - THREE International" before the main headline. For a Team Magnificent identity push, Team Magnificent should be the first visual signal, with THREE International framed as supporting context where needed.

### Excessive empty space is not being used for brand atmosphere

There is large vertical space in `welcome.tsx`, `ivory.tsx`, and `cockpit.tsx`, but much of it is plain ink background. Empty space can feel premium when it is intentionally branded. Right now it often feels like unfilled app chrome.

Use the compass mark, hero wordmark, linework, or subtle oversized watermarks to make that space feel owned by Team Magnificent.

### Typography is strong but unevenly deployed

The token stack is good:

- Display: Bebas Neue.
- Body: DM Sans.
- Mono: DM Mono.

The prospect dashboard uses the typography cinematically. Cockpit and Ivory use it more like an internal SaaS tool. That is appropriate for utility, but the first viewport still needs a stronger branded header so utility does not erase identity.

### Gold and teal need clearer roles

Current palette:

- Ink: premium canvas.
- Gold: brand authority, prestige, commitment.
- Teal: live motion, system intelligence, action.
- Cream: readability.

The reviewed pages sometimes use teal as the first brand accent, especially `ivory.tsx` with "Team Magnificent - Ivory" in teal. That makes Ivory feel like a feature brand, not a Team Magnificent surface.

Recommended balance:

- Gold should own the brand, wordmark, commitments, hero rules, and primary identity moments.
- Teal should own live state, AI/coach intelligence, motion, completion, progress, and secondary action.
- Avoid letting teal become the identity color.

## 2. Recommended Logo Usage

### Establish asset roles

Use the logo assets consistently:

- `logo_dark_hero.png`: major hero identity, welcome page, dashboard arrival, premium section breaks.
- `logo_navbar.png`: persistent header/ribbon identity.
- `logo_icon.png`: compact icon, favicon-style mark, app rail mark, animated watermark.
- `logo_dark_square.png`: loading states, empty states, share cards, modal brand panels.
- `logo_light_print.png`: print/export/light-background documents only.

### Size recommendations

Use real logo assets larger than the current UI labels:

- Sticky/app headers: `logo_navbar.png` at 180-240px wide on desktop, 140-180px mobile.
- Prospect dashboard ribbon: 160-220px wide wordmark, not a 22px hand-drawn mark.
- Welcome top strip: replace `h-7` icon-only scale with a 180-240px wordmark.
- Welcome hero: use `logo_dark_hero.png` or the wordmark portion at 420-760px wide above or behind the welcome headline.
- Cockpit/Ivory page headers: use `logo_navbar.png` at 180-220px wide plus the module name as the secondary label.
- Footers: use `logo_navbar.png` at 260-360px wide or `logo_dark_hero.png` at 520-760px wide for a true brand close.

### Icon-only rule

Do not use `logo_icon.png` alone as the primary brand signal unless a visible Team Magnificent wordmark is nearby. The icon is strong, but without the wordmark it reads as an emblem, not the full identity.

## 3. Header/Ribbon Recommendations

### Prospect dashboard ribbon

Current state:

- Small sticky ribbon.
- Hand-drawn CSS compass mark.
- Text label "Team Magnificent."
- Live status on the right.

Recommended:

- Replace the custom CSS mark with `logo_navbar.png`.
- Make the ribbon taller and more intentional: 64-76px desktop, 56-64px mobile.
- Put the Team Magnificent wordmark on the left at 160-220px wide.
- Keep the live/holding-tank status on the right, but let teal remain a live-state accent.
- Add a thin gold top or bottom rule so the ribbon feels like a branded broadcast strip, not a browser toolbar.

### Internal `.team` headers

`ivory.tsx` and `cockpit.tsx` need a shared branded header pattern:

- Left: `logo_navbar.png`.
- Right: module name, for example "Ivory" or "Cockpit."
- Beneath: page-specific headline.
- Background: ink with a faint oversized compass watermark.
- Bottom: subtle gold line with optional teal pulse for live/system status.

This will make every BA-facing tool feel like part of Team Magnificent, not a set of separate utilities.

### Welcome header

The welcome page should be the premium onboarding ceremony. The current hero has energy, but the top brand strip is too small.

Recommended:

- Use `logo_navbar.png` in the top strip instead of a 28px icon plus text.
- Let "Brand Ambassador - Onboarding" become the secondary label.
- Move THREE International language lower in the hierarchy so Team Magnificent is the first visual read.
- Add a strong Team Magnificent wordmark lockup in the hero before or behind "WELCOME TO THE TEAM."

## 4. Dashboard Brand Improvements

### Arrival section

The arrival section is visually strong, but not branded enough. The first dashboard viewport should immediately say Team Magnificent as a visual identity, not only through copy.

Recommendations:

- Add a large ghosted `logo_dark_hero.png` or compass watermark behind the arrival headline.
- Add a visible wordmark above the headline, not just the sticky ribbon.
- Consider a branded "Team Magnificent Holding Tank" lockup near the position card.
- Use the compass mark as the position-card seal, not only gold borders and numbers.

### Section-level branding

The dashboard has strong motion and strong numbers, but most sections could belong to any premium product if the copy were removed.

Recommendations:

- Add a small, consistent section seal in the upper-right of major sections.
- Use a subtle compass-line motif behind the 100,000 mission board.
- Use the wordmark again before the final CTA so the conversion moment is branded.
- Upgrade the footer from a small CSS mark to a real wordmark close.

### Gold/teal balance

The dashboard currently uses gold for prestige and teal for live mechanics. That is correct. The improvement is to make gold carry the Team Magnificent brand more consistently:

- Gold wordmark/rules in ribbon and footer.
- Teal only for live pulses, placement activity, active counters, and system motion.
- Gold for "Team Magnificent" and "100,000" identity moments.

## 5. Team Onboarding Brand Improvements

### Welcome page

`welcome.tsx` is the strongest reviewed `.team` brand surface, but it still has hierarchy issues.

What is working:

- Large ceremonial welcome headline.
- Oversized compass icon behind the hero.
- Gold commitment band.
- Kevin and Paul signature blocks.
- Strong emotional page rhythm.

Weaknesses:

- Header logo is too small.
- The full wordmark is not used.
- The oversized compass is atmospheric but does not teach the wordmark.
- THREE International appears in the hero support text, which may dilute the Team Magnificent first impression.

Recommendations:

- Replace the top icon/text pair with `logo_navbar.png`.
- Add `logo_dark_hero.png` as a hero lockup above the welcome headline or as a wide translucent layer behind it.
- Keep the compass watermark, but reduce it if the full wordmark is introduced.
- Add a Team Magnificent closing mark above the accept CTA so the commitment action feels branded.
- Use gold for ceremony and commitment, teal only for recorded/unlocked/progress states.

### Training and onboarding continuity

The welcome page should establish a pattern that other onboarding screens inherit:

- Branded header.
- Large Team Magnificent wordmark or seal on first viewport.
- Module label secondary.
- Gold rule or band to create ceremony.
- Teal only when something activates, unlocks, completes, or goes live.

## 6. Ivory/Cockpit Brand Improvements

### Ivory

Current state:

- Header says "Team Magnificent - Ivory" in small teal mono text.
- Main headline is "Who do you know?"
- No visible logo asset.
- Page feels useful, but more like a private CRM tool than a branded Team Magnificent experience.

Recommendations:

- Add `logo_navbar.png` to the Ivory header.
- Make "Ivory" the module name, not the brand leader.
- Add a large faint compass watermark in the header area.
- Use gold for Team Magnificent identity and selected product states.
- Use teal for coach intelligence, quick-add confirmation, generated prompts, and active progress.
- Add a branded empty state using `logo_dark_square.png` when the roster is empty.
- Product gallery cards should feel more premium: stronger gold top rule, subtle image/mark area, and consistent selected-state glow.

### Cockpit

Current state:

- Header is text-only: "TEAM MAGNIFICENT - COCKPIT."
- No logo or persistent brand strip.
- Counts strip and invitation rows are functional but visually modest.
- Shell is plain ink with constrained content.

Recommendations:

- Add a branded app header with `logo_navbar.png`.
- Expand the first viewport into a cockpit command header: wordmark, welcome, primary CTA, live status.
- Use a compass watermark behind the counts strip.
- Make the counts strip more visually owned: gold frame, teal accent only for callbacks/live actions.
- Add a branded side-rail cap above My Sponsor/Orientation/Leadership.
- For empty invites, use the compass/wordmark and make "Who are you sharing with today?" feel like a Team Magnificent operating command.

### Shared `.team` app shell

The biggest `.team` opportunity is a shared brand shell:

- Top wordmark header.
- Module label.
- Subtle atmospheric ink/gold/teal mesh like `.com`.
- Optional compass watermark.
- Branded footer or low-contrast wordmark on longer pages.

That would lift Ivory, Cockpit, invitations, training, and welcome without over-decorating each tool.

## 7. Motion/Animation Opportunities

### Brand motion

Use motion to make the brand memorable, not decorative:

- Compass mark slow rotate or sweep on major page load.
- Gold line draw under the wordmark.
- Teal center dot pulse only for live/active states.
- Wordmark fade/rise on first viewport.
- Subtle parallax on oversized compass watermark.

### Prospect dashboard motion

The dashboard already has useful live motion. Add brand motion around it:

- Ribbon wordmark settles in first, then live pulse activates.
- Position card receives a compass seal stamp animation.
- Live placements pass through a faint vertical compass axis.
- Final CTA can replay a small gold line-draw under Team Magnificent.

### Welcome motion

The welcome screen should feel ceremonial:

- Hero wordmark rises before "WELCOME TO THE TEAM."
- Compass glow can continue, but slower and subtler.
- Gold commitment band can reveal with a horizontal line wipe.
- Accept CTA can transition to teal only after commitment is recorded.

### Ivory and Cockpit motion

Keep internal tools calmer:

- Header wordmark appears once, no repeated animation.
- Teal pulse only for live data, coach thinking, generated prompts, or action completion.
- Counts can count up on load.
- Empty states can use a soft compass glow to feel alive without becoming theatrical.

## Priority Recommendations

1. Use `logo_navbar.png` in every reviewed page header/ribbon.
2. Use `logo_dark_hero.png` in the first viewport of welcome and prospect dashboard.
3. Replace hand-drawn CSS marks in dashboard ribbon/footer with real logo assets.
4. Create a shared `.team` branded header/shell for Ivory and Cockpit.
5. Make gold the Team Magnificent identity color and reserve teal for live/action/system states.
6. Add oversized, low-opacity compass/wordmark treatments to empty ink space.
7. Add restrained brand motion: compass sweep, gold line draw, teal live pulse.

## Bottom Line

Team Magnificent already has the ingredients for a premium, memorable identity: a strong compass mark, a full hero wordmark, cinematic ink/gold/teal tokens, and expressive display typography. The current implementation often reduces that identity to small text labels and utility chrome.

The fix is not a new brand. The fix is to let the existing brand assets lead the screens.
