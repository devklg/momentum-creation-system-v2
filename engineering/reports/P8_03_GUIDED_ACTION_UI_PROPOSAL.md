# P8.3 — Guided Action UI Proposal (WIREFRAME / CONTRACT ONLY — NO IMPLEMENTATION)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: UI PROPOSAL — no `apps/**` code is authorized by this document
- Surface: `apps/team` (BA-facing) ONLY. Never `apps/com`, never `apps/admin` (admin
  sees aggregate metrics only, consistent with the compliance-dashboard pattern).
- Depends on: `P8_02_GUIDED_ACTION_CONTRACT.md` (lifecycle + confirmation model),
  S2 plan §9 (UI handoff expectations)

## 1. Placement

A **"Suggested Actions" panel** inside the agent session view (where Steve/Michael/
Ivory turn results render), plus an optional read-only "Open suggestions" card on the
cockpit. No global nav item, no badge counters that pressure the BA, no notification
push. Suggestions are visible when the BA is already working — they do not chase the
BA.

## 2. Wireframe — suggestion card (state: `suggested`)

```
┌──────────────────────────────────────────────────────────────┐
│ SUGGESTED ACTION                              expires in 3d  │
│                                                              │
│  Review your Success Profile draft                           │
│  Why: your interview finished but the profile draft is       │
│  still unconfirmed.                        (reason, packet-  │
│                                             local, template) │
│                                                              │
│  This is a suggestion. Nothing happens unless you act.       │
│                                                              │
│  [ Accept — I'll do this ]   [ Decline ]                     │
└──────────────────────────────────────────────────────────────┘
```

State: `accepted` (same card, controls change):

```
│  Accepted on Jul 1. When you've done it, confirm below.      │
│  [ Open profile draft ]  ← internal .team deep-link only     │
│  [ I did this — mark complete ]   [ It didn't work — failed ]│
```

Terminal states render as a muted single line (`Declined`, `Expired`, `Completed
Jul 2`, `Failed`) in a collapsible history list. Degraded-context fallback cards
(`contentScope: 'limited'`) show the safe-fallback text from the envelope and only
the `record_private_note` action.

Copy-only suggestion kinds (`copy_draft_manually`, `suggest_webinar_invite`) add:

```
│  ┌────────────────────────────────────────────┐              │
│  │  [compliance-checked draft text]           │  [ Copy ]    │
│  └────────────────────────────────────────────┘              │
│  Send this yourself, from your own phone/email.              │
│  Team Magnificent never sends messages for you.              │
```

## 3. UI contract (normative rules for the future implementation)

1. **One click = one instance = one transition.** No multi-select, no "accept all",
   no keyboard shortcut that batches. Each Accept/Decline/Complete acts on exactly
   one guided action and requires its own click.
2. **No default action.** Neither button is focused/primary-styled in a way that
   makes Enter-mash accept. Card dismissal (X / scroll away) is NOT decline — it
   leaves the suggestion `suggested`.
3. **Honest verbs.** "Accept — I'll do this", "I did this". Never "Run", "Execute",
   "Send", "Schedule", "Automate". The UI vocabulary must make the ownership model
   unmistakable: BAs are sharers acting on their own relationships.
4. **Reason always visible.** Every card shows its packet-local reason. A suggestion
   with no reason must not render (fail closed).
5. **Expiry is passive.** The countdown is display-only, computed at render. A lapsed
   card re-renders as `expired` on next read; no client timer fires a state change.
6. **Deep-links are internal-only.** `Open …` buttons navigate within `.team` routes.
   No `mailto:`, `tel:`, `sms:`, or external hrefs from a guided-action card in this
   design (copy-only pattern instead; revisit only via a future approved ACR).
7. **Safe failure text.** Envelope/network errors render "We couldn't load
   suggestions. Your work is unaffected." — never a retry loop that could double-fire
   a transition. Transition requests are idempotent per (guidedActionId, transition).
8. **No hidden side effects.** The only network calls a card may make are: fetch
   suggestions, and the single transition request the BA clicked. Nothing on mount,
   hover, or unmount.
9. **Compliance rendering.** Draft text renders through the existing fail-closed
   compliance path. If the check fails, show the compliance-blocked state (as Ivory
   does), never the raw text.
10. **Accessibility + brand.** Cards use brand tokens verbatim
    (`packages/shared/src/brand.ts` — Bebas Neue display, DM Sans body); focus-visible
    rings on all controls; transition buttons are real `<button>`s announced with the
    suggestion title.

## 4. What this UI never shows

- Prospect scores, rankings, "hot lead" indicators, or any prioritization dressing.
- Income/earnings framing on any suggestion ("this could earn you…" — prohibited).
- Team head count, placement/queue promises, THREE branding.
- Auto-send/auto-schedule affordances — no toggle, no "do this automatically next
  time" checkbox. Such a control may not even appear disabled.

## 5. Server surface (named, not designed)

The panel implies future BA-authed, `requireSteveComplete`-gated `.team` endpoints
(list suggestions; post one transition). They are **not** designed here: no
`/api/runtime/*` mount, no route file, no handler shape. Endpoint design belongs to
P8.8 after Phase 7 closes, mounted per the documented server boot-order rules
(gated section of `server/src/index.ts`), append-only.
