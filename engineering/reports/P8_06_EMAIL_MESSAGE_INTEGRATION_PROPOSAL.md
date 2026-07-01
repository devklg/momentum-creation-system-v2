# P8.6 — Email / Message Integration Proposal (BOUNDARY / PROPOSAL ONLY)

- Date: 2026-07-01
- Phase: Phase 8 — Guided Action and External Integration Boundaries
- Status: PROPOSAL — no implementation. **This document deliberately designs NO send
  path.** Nothing here may be wired to auto-send, and nothing here creates a
  BA-triggered in-app send either.
- Governing boundary: `P8_04_WORKFLOW_AUTOMATION_BOUNDARY_REVIEW.md` (Tier 3 items 1)

## 1. Two email surfaces exist; this proposal separates them permanently

**Surface A — system transactional email (exists, out of Phase 8 scope).**
`server/src/services/resend.ts`: dormant-by-design, best-effort, single transactional
sends for approved system functions (e.g. prospect submission follow-ups), degrading
to `emailDeliveryStatus='skipped'` without `EMAIL_API_KEY`. Phase 8 does not touch,
extend, or route through it.

**Surface B — BA relationship messaging (the guided-action concern).** Messages from
a BA to their prospect/team. **Proposal: this surface is copy-only, permanently, at
the contract level.**

The wall between them: guided-action/integration code may never import or call
`services/resend.ts`, `services/telnyx.ts`, `broadcastQueue.ts`, or any transport
(P8.2 §8 conformance item). Surface A's dormancy is an env-key matter for approved
system functions; Surface B has no transport to awaken.

## 2. The copy-only contract for BA messaging

What the system provides:

1. **Compliance-checked draft text** — template/catalog-sourced (ScriptMaker-pattern;
   the Anthropic surface stays dormant and is not part of this design). Fails closed
   at render if the compliance check fails.
2. **A Copy button.** Clipboard only.
3. **Honest framing copy**, verbatim intent: "Send this yourself, from your own phone
   or email. Team Magnificent never sends messages for you."

What the system never provides for Surface B:

- No send button, no "send via Team Magnificent", no SMTP/API relay of BA messages.
- No `mailto:` / `sms:` deep-links in this design (they encode recipient + body and
  are one approval away from being send-shaped; revisit only via ACR).
- No delivery tracking of BA-sent messages (no pixels, no "did they open it"), which
  would require the message to pass through us — it must not.
- No scheduling of messages ("remind me to send Tuesday" is a `crm_followups`
  reminder — a Tier 2 CRM act — not a queued message).
- No sequences, cadences, drips, or bulk compose ("write this for all 12 prospects").
  One draft, one prospect-relationship, one BA decision.

## 3. Why copy-only is the design and not a placeholder

- **Compliance:** the moment the app transmits a BA's relationship message, the app
  becomes the speaker — income-claim and AI-prospecting exposure lands on the
  platform. Copy-only keeps the BA the speaker in fact and in record.
- **Authenticity:** BAs are sharers; messages must arrive from the BA's own number/
  address on the real relationship channel — deliverability and trust both break
  under relay.
- **Governance:** any future request to add sending is a Tier 3 unlock: it requires
  its own ACR with Kevin's approval, and is expected to be declined. Recording that
  expectation here is part of the boundary.

## 4. Guided-action integration points

| Kind | Behavior |
|---|---|
| `copy_draft_manually` | Card shows draft + Copy (P8.3 §2 copy-only card). Completion = BA attestation ("I sent it myself"), optionally reflected as a CRM note prefill. |
| `suggest_webinar_invite` | Same copy-only card with next seeded webinar details embedded in the draft text (see P8.7). |

Outcome capture records *that the BA reported sending* (`outcome.confirmed_by_ba`),
never delivery facts the system cannot honestly know.

## 5. Persistence

Draft text shown, copy events, and attestations persist (future, gated) only as
guided-action lifecycle records via the P7.3 seam — never as a message store, never
as an outbox. There is no outbox. An outbox implies a sender.
