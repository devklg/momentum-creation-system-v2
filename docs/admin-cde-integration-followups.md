# /admin C·D·E — Integration & Deferred Follow-ups

**Captured:** Chat #137, 2026-05-25. **Status:** ALL THREE COMMITTED — C (`3ffec8b`), D (`572c427`), E (`6c19309`). Ready for integration pass.
**Why this file exists:** the three agents' `claude-notes-admin-*.md` are gitignored and live inside worktrees that get pruned after merge. This file preserves the cross-cutting decisions + deferred work in the tracked repo so it survives cleanup. Source of detail: each worktree's `claude-notes-admin-{c,d,e}.md` until those trees are removed.

---

## A · INTEGRATION WIRING (do once, at merge, by one hand — NOT by any agent)

Three shared files get the same three-edit treatment per surface. Exact snippets/line targets are in each worktree's notes; summary:

**`server/src/index.ts`** — import + mount, under the existing admin-gated block:
- E: `import { adminQueueRoutes } ...` → `app.use('/api/admin/queue', adminQueueRoutes)`
- D: `import { adminProspectsRoutes } ...` → `app.use('/api/admin/prospects', adminProspectsRoutes)`
- C: NONE — `adminBasRoutes` already mounted at `/api/admin/bas` (pre-#135). C extended that existing router.

**`apps/admin/src/App.tsx`** — import + `<Route>` inside the `<AdminShell>` authed block:
- E: `<Route path="/queue" element={<QueuePage />} />`
- D: `<Route path="/prospects" element={<ProspectsPage />} />`
- C: NONE — `/bas` route already present (App.tsx:62). C rewrote `BAsPage` in place.

**`apps/admin/src/components/admin-shell.tsx`** — append to `NAV` array. Data-flow order: codes → BAs → prospects → queue → audit:
- D: `{ to: '/prospects', label: 'Prospect Oversight' }`
- E: `{ to: '/queue', label: 'Queue Oversight' }`
- C: NONE — `{ to: '/bas', label: 'Brand Ambassadors' }` already present (admin-shell.tsx:21).

**Net: only D and E need wiring (2 surfaces × 3 files). C is wire-free — it extended pre-mounted files.**

---

## B · KNOWN MERGE CONFLICT — `packages/shared/src/types.ts`

**All three agents append to this shared file** (E +189, D +294, C +162), each from a base that lacked the others' additions. **Expect a 3-way conflict at merge.** Resolution is mechanical: all additions are EOF-appended, no existing exports touched, no name collisions across the three (C = `AdminBa*`, D = `AdminProspect*`, E = `Queue*`/`AdminTicker*`). Concatenate all three blocks; verify no duplicate type names. This is a brief-authoring miss (types.ts should've been named append-only-shared up front), not an agent error.

---

## C · DEFERRED READ-THROUGHS — "stored but not yet enforced" (KEVIN DECISIONS)

These are admin controls that PERSIST + AUDIT correctly but do NOT yet change real system behavior. The UI is honest about "future placements" in one case; the gap is the write-path wiring, which lives in files the agents didn't own.

1. **E.3 visible-window → `.com`** — setting persists in `momentum.admin_settings` (`queue_visible_window`, default 10), admin reads/writes/previews it, but `.com` still uses hardcoded caps (`usePlacementStream.ts` MAX_TICKER_ENTRIES=80; `p.ts` SSE_SNAPSHOT_RECENT_LIMIT=40). 3-edit follow-up (recipe in `claude-notes-admin-e.md` §4): public read endpoint → SSE snapshot uses stored value → `.com` reads `visibleWindow` off the snapshot event.

2. **E.6 `flush_weeks` → token mint** — rule stored + audited in `momentum.admin_settings` (`queue_flush_weeks`, default 8), but `domain/tokens.ts` still bakes 8wk at `TOKEN_TTL_MS`. UI states "applies to future placements" — currently it does NOT until mint reads `getQueueRule('flush_weeks')`. ~2-line change in `tokens.ts`.

---

## D · DATA-MODEL GAPS SURFACED BY AGENT D (KEVIN DECISIONS)

1. **Registration handoff state (D.1 col 10)** — no `registrationHandoffState` field exists. D DERIVES it from `pool_placements.flushReason`: no/null-flush → `pending`; `enrolled` → `enrolled`; `expired` → `no_show`; `archived` (admin early-flush) → `withdrew`. **If you want a TRUE no-show** (e.g. webinar registered, didn't attend, distinct from expiry), that needs a new field + write-path. Current code treats "expired w/o enrollment" as the closest no-show signal.

2. **Click IP + referrer (D.2 timeline)** — not persisted on `invite_tokens` (only `clickedAt` exists). D surfaces `ip:null`/`referrer:null` so the panel doesn't lie. To populate, the `/api/p/:token` resolve path that flips state→`clicked` must capture `req.ip` + `Referer` — a write to `domain/tokens.ts` (different branch / future work).

3. **THREE authority** — the 4 handoff-state values are an OPERATIONAL MIRROR; real registration/genealogy state is in THREE. Admin does not replicate THREE's full model. (Consistent with locked-spec — noted, no action.)

4. **System-detected leader tag is DORMANT (Agent C)** — the locked rule (binary-qualified ∧ ≥5 personally enrolled) can't evaluate because THREE's binary-qualification feed isn't mirrored locally, so `systemDetectedLeader` is always `false`. C discloses this honestly via `leaderDetectionNote` on the directory response (same wording the Core Dashboard uses). Kevin-CURATED leader tags work fully. Unblocks when THREE qualification mirroring lands.

5. **C.4 "30-day 2-in-72 history" not wired (Agent C)** — current 72h count is wired; the trailing-30-day trail the spec mentions is not. Easy follow-on: bucket `invite_tokens` by `createdAt` day over trailing 30.

6. **Suspended-status toggle not writable from C surface** — `deriveStatus()` already respects a `suspended:true` flag on `brand_ambassadors` and the column displays active/inactive/suspended correctly when the flag exists, but no UI writes it. Display-complete, write-path absent.

7. **Leader-tag row toggle is reason-less (Agent C)** — the row toggle hits the same audited endpoint but collects no reason. Endpoint accepts an optional reason; future enhancement is to prompt on the demote (true→false) path.

---

## E · DELIBERATE DEVIATION — Agent D sandbox-preview (REVIEW)

Brief D.1 pointed at existing `preview.ts`/`previewToken.ts` for the "sandboxed preview that doesn't fire a real click." That existing route is the BA-on-own-page sandbox (`PREVIEW-<baId>` sentinel, Chat #134) — NOT built for admins previewing a REAL prospect's `/p/{token}`. D shipped a SEPARATE read-only path instead: `GET /api/admin/prospects/:prospectId/sandbox-preview` synthesizes a `ResolvedTokenPayload` snapshot from prospect+token+BA+webinar records, PURE READS, no state transitions, no SSE emit; client renders inline (no iframe to .com). Conservative and honors the brief's intent — but it's a deviation from the literal instruction, so eyes on it at review.

---

## F · CONTRACTS CONFIRMED RESOLVED

- **E↔D `prospectId` deep-link:** BOTH agents independently locked `/prospects?prospectId=<id>`. D opens its D.2 panel on that param; E builds links with it (`adminQueueOversight.ts::buildProspectDeepLink()`). No mismatch. ✅
- **Collision discipline held:** none of C, D, E touched `App.tsx`, `admin-shell.tsx`, `server/src/index.ts`, or `CLAUDE.md`. All three gitignored `claude-notes-*.md`. ✅
- **New Mongo collections (lazy-created on first write), all admin-only:**
  - C: `admin_sponsor_overrides` (append-only, fans to Neo4j+Chroma), `admin_curated_leader_tags` (Mongo+audit), `admin_ba_notes` (append-only, Mongo+audit)
  - D: uses existing `pool_placements`/`prospects`/`audit_log`; no new collection
  - E: `admin_settings` (`queue_visible_window` default 10, `queue_flush_weeks` default 8)
- **Sponsor override (C.5) substrate↔record link:** C writes the critical-severity audit entry FIRST so the override row carries its `auditEntryId`. `originalSponsorBaId` stamped only on first override (re-overrides don't drift the original). ✅

---

## G · PRE-MERGE LIVE VERIFICATION (needs running stack + admin session cookie)

Static verification (typecheck, read-back of writes) PASSED for both D and E. End-to-end HTTP cannot be claimed from a static build — run `pnpm dev:server` + `pnpm dev:admin`, sign in as an `ADMIN_BA_IDS`-listed BA, then:
- **E:** exercise all six queue panels; PUT visible-window + a queue rule, confirm audit rows + read-back.
- **D:** run all four interventions (move / reassign-sponsor / manual-flush / force-enroll) against a seeded prospect; confirm `positionNumber` UNCHANGED each time, audit row with before/after/reason present; confirm sandbox-preview leaves token state un-advanced; confirm `?prospectId=` deep-link opens the panel.

---

*Update this file when C reports, when conflicts are resolved at merge, and when each deferred item (C.1, C.2, D.1, D.2) is either scheduled or shipped.*
