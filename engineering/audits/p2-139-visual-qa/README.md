# P2-139 fallback component visual QA

Date: 2026-07-16

## Result

Pass for the isolated provider-selection component harness at:

- desktop: 1440 × 900
- tablet: 768 × 1024
- mobile: 390 × 844
- small mobile: 360 × 800
- 200% reflow: 720 × 900 CSS pixels with device scale factor 2

The responsive renders show no horizontal clipping, overlap, or unreadable
content. The selector exposes the campaign-selectable provider catalog while
registered-dormant, planned, and unavailable identities are rendered only in
the non-selectable evidence area. The harness performs no provider call,
queue write, campaign mutation, or external communication.

The Vite harness completed these captures without an error overlay or stderr
runtime error. Provider-option identity and fail-closed behavior are covered
by the automated catalog, API, registry, and worker tests recorded in the
P2-139 audit report.

## Evidence

- `desktop-1440x900.png`
- `tablet-768x1024.png`
- `mobile-390x844.png`
- `small-mobile-360x800.png`
- `reflow-200-percent.png`

## Gate limitation

This is fallback component evidence, not authenticated trusted-route QA. The
in-app browser control surface required by the trusted browser workflow was
not exposed in this session, so no trusted-route pass is represented.
