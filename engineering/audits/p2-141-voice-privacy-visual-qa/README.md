# P2-141 local-device voice privacy visual QA

Reviewed: 2026-07-16

## Result

The production `SteveSuccessInterviewPage` was rendered with a synthetic
in-flight discovery state after the local-device voice privacy change.

All five captures show:

- the typed-input fallback;
- the local-device voice privacy notice;
- the Voice/Input/Send composer without horizontal overflow;
- the discovery intro without the prior empty-state auto-scroll; and
- zero captured browser exceptions.

The Chrome runtime exposed both the experimental local-recognition property and
a local TTS voice, so the Voice button was visible. The QA did not click the
button, request microphone permission, invoke speech recognition/TTS, call a
provider, or send a conversation.

## Captures

- `desktop-1440x900.png`
- `tablet-768x1024.png`
- `mobile-390x844.png`
- `small-mobile-360x800.png`
- `reflow-200-percent.png` — 720 CSS pixels at device scale factor 2

Exact browser measurements are in `browser-results.json`. Every capture reports
`horizontalOverflow:false`, `privacyNoticeVisible:true`,
`typedFallbackVisible:true`, `inputVisible:true`, and no exceptions.

## Boundary

This is fallback actual-component evidence from a local throwaway harness. The
trusted in-app route browser remained unavailable, so this is not represented
as trusted-route or live microphone QA.
