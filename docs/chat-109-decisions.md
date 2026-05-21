# Chat #109 — Section 10 callback-request form

Date: 2026-05-20
Project: Momentum Creation System v1
Surface: `apps/com` — `tm-video-presentation` — Section 10 (The Quiet Door)

Chat #109 replaced the Chat #107 placeholder card on Section 10 of `tm-video-presentation` with the real callback-request form, wired the matching server route, and persisted the SMS-to-BA notification path. All five workspace packages typecheck clean.

---

## Decisions locked

### 1. Two intent radios only on Section 10

The presentation page (`tm-video-presentation`) carries two soft-CTA radios:

- **I'm interested — tell me more**  (`interested_tell_me_more`)
- **I have questions**  (`have_questions`)

The harder "I'm ready to join" intent is **intentionally absent** from Section 10. Rationale (Kevin, Chat #109 verbatim):

> "I want to join. Let's go. We don't even wanna have that there because they don't even know that there's something to join yet. All they've seen is a video. And then when we get them onto the next dashboard, that's when they'll see, hey. I'm ready to join."

The `ready_to_join` intent will be added to the `CallbackIntent` union when dashboard Section 6 ships. Server, client, and SMS templating all branch on the discriminator — expanding the union is the only edit needed at that point.

### 2. No phone collection on Section 10

No phone field. No best-time field. Rationale (Kevin, Chat #109 verbatim):

> "We do not have to request their telephone number. We already have all their information."

The inviting BA already has the prospect's contact info — they sent the link to a person they already know. Collecting the phone again would imply the system doesn't trust the BA-prospect relationship that earned the invite. The intent itself is the message.

### 3. Callback request is NOT a token lifecycle state

Reaffirms Chat #105 spec amendment. Submitting a callback request does **not** transition the token's `state`. Callback requests are independent intent records that may co-exist with any lifecycle position. A prospect can:

- Submit before `video_complete`
- Submit after `video_complete`
- Submit multiple times over the 8-week consideration window

The token continues its own funnel rail (`clicked` → `video_started` → ... → `video_complete`) unaffected by callback-request submissions.

### 4. SMS to BA is best-effort; record always commits

Telnyx SMS to the BA fires AFTER the triple-stack write commits. If the SMS fails (BA phone missing, Telnyx config error, transient API failure):

- The callback-request record still persists.
- The route still returns 200 to the prospect.
- `smsDeliveryStatus` is captured on the record (`sent` | `failed` | `skipped`) along with `smsDeliveryError` text.
- The BA cockpit alert is the canonical surface for raised hands — the SMS is a convenience, not the source of truth.

The prospect's submission landed regardless. The page confirms with the BA's first name.

### 5. Compliance held on Section 10

The locked compliance posture on `.com` (locked-spec Part 3.10) is preserved throughout:

- No income claims.
- No placement promises.
- No AI prospecting.
- No PMV cycles language.
- No THREE branding.
- The form names the inviting BA per locked-spec Part 3.9 personalization rule, which is factually neutral ("invited by" is not a binary-leg promise).

Confirmation copy: "[BA First Name] will reach out to you soon." — promises nothing about timing, outcome, or compensation.

---

## Architecture

### Server

```
POST /api/p/:token/callback-request
Body: { intent: 'interested_tell_me_more' | 'have_questions' }
```

Status codes:
- **200** — record created, SMS attempted (best-effort)
- **400** — missing/invalid intent
- **404** — unknown token (or sponsor BA missing for token)
- **409** — token enrolled
- **410** — token expired
- **500** — triple-stack write failure

Sponsor immutability (locked-spec Part 3.5): `sponsorBaId` is read from the token record only. Request body has no BA fields.

### Triple-stack write

1. **MongoDB** `callback_requests` — the record. `_id = callbackRequestId`.
2. **Neo4j** — `(:Prospect)-[:REQUESTED_CALLBACK {callbackRequestId, intent, createdAt}]->(:BA)`. Created (not merged) so multiple requests over time produce multiple edges; cockpit walks the latest by `createdAt` and surfaces older on the activity timeline.
3. **ChromaDB** `mcs_callback_requests` — semantically searchable event document for `/admin` live operations.

Followed by a Mongo `update` to patch `smsDeliveryStatus` + `smsDeliveryError` + `smsDeliveredAt` after the Telnyx call completes.

### Client

- `apps/com/src/lib/api.ts` exports `postCallbackRequest(token, intent)` returning a tagged discriminated union for typed error handling.
- `apps/com/src/routes/tm-video-presentation/sections/10-QuietDoor.tsx` is the form. Three states: `idle`, `submitting`, `submitted`, `error`.
- Submit button is disabled until an intent is selected and during submission to prevent double-submit.
- Errors render inline (`role="alert"`); confirmation replaces the form entirely with teal-accented copy (vs. the gold-accented form state).

---

## Files

| File | Action | Lines |
|---|---|---|
| `packages/shared/src/types.ts` | MODIFIED | `CallbackIntent` narrowed to 2 options; `CallbackRequestPayload`, `CallbackRequestResponse`, `CallbackRequestRecord` added |
| `server/src/services/telnyx.ts` | MODIFIED | `sendSms()` added for Telnyx Messaging API (POST /v2/messages) |
| `server/src/domain/callbackRequest.ts` | NEW | 209 lines — triple-stack write + best-effort SMS |
| `server/src/routes/p.ts` | MODIFIED | `POST /api/p/:token/callback-request` handler |
| `apps/com/src/lib/api.ts` | MODIFIED | `postCallbackRequest` client + `CallbackRequestError` discriminated union |
| `apps/com/src/routes/tm-video-presentation/sections/10-QuietDoor.tsx` | REWRITE | 401 lines — placeholder → real form |
| `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx` | MODIFIED | Pass `token` prop to `QuietDoor` |

---

## Verification

- `packages/shared` build (emit) — exit 0 ✅
- `server` typecheck — exit 0 ✅
- `apps/com` typecheck — exit 0 ✅
- `apps/team` typecheck — exit 0 ✅
- `apps/admin` typecheck — exit 0 ✅

ChromaDB `mcs_callback_requests` collection bootstrapped (pre-existing from earlier session; verified via `create_collection` returning `resource_already_exists`).

---

## Open after Chat #109

1. **Telnyx .env values** — `TELNYX_API_KEY` + `TELNYX_FROM_NUMBER` required for live SMS dispatch. Missing values surface as `TelnyxConfigError` and persist as `smsDeliveryStatus = 'failed'` with `smsDeliveryError = 'missing required env vars: ...'`. The record still commits and the route still returns 200.
2. **BA cockpit raised-hand surface** — the canonical place to see callback requests; TEAM Design Section H.4 ("today's actions"). Not in scope for Chat #109.
3. **Dashboard Section 6** — the post-video `ready_to_join` CTA. When this ships, expand `CallbackIntent` union to add `'ready_to_join'` and update Section 10 → Section 6 routing copy in SMS template.
4. **Webinar reservation route** (`POST /api/p/:token/webinar-reservation`) — cockpit-only signal (no SMS), per Chat #105 spec amendment. Parallel to callback-request but webinar reservation lives on dashboard Section 6 (not Section 10).
5. **Commit + push Chat #109 work** — standing rule held; awaiting Kevin's approval before pushing to `github.com/devklg/momentum-creation-system-v1`.
