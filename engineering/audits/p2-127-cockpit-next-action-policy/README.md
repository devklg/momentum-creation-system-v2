# P2-127 Cockpit Next-Action Policy

Status: implemented and regression-covered.

## Authority and scope

The existing BA-scoped PMV projection already carried a `nextAction` object and
the Cockpit already rendered it in the Focus Queue and prospect rows. P2-127
closes the audit gap by extracting the private branch chain into a versioned,
ordered, pure policy in `server/src/domain/cockpit-next-action.ts`.

The policy uses only explicit lifecycle activity, a BA-created reminder, and
the current reporting instant. It does not score, rank, qualify, predict, or
automatically contact a person. Every contact suggestion remains a manual BA
action.

## Precedence

1. Terminal or archived state: no PMV action.
2. Explicit callback request: reply to callback.
3. BA-created reminder due: follow up.
4. Presentation complete: call now.
5. Draft invitation: manually send.
6. Expired consideration window: consider re-invite.
7. Opened without a start: ask whether the video played.
8. Partial presentation: send a soft nudge.
9. Sent and unopened for at least 48 hours: send a soft nudge.
10. Sent and unopened for less than 48 hours: wait.

The Focus Queue continues to prioritize suggested manual work; it now also
shows the policy's behavioral reason so the suggestion is explainable.

## Verification

`server/src/domain/__tests__/cockpitNextAction.test.ts` covers every PMV
lifecycle, precedence, the exact 48-hour boundary, repeatability, manual-only
policy metadata, and forbidden PMV language.
