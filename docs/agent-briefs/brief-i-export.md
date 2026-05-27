# Agent Brief — I-export (ADMIN I.4/I.5 Export with PII redaction)

**Round:** Chat #144 fan-out.
**Branch:** `feat/admin-i-export-redaction`
**Worktree:** `D:/mcs-i-export`
**Sibling agents:** H-server, H-UI, G-broadcast.

---

## What you're building

The last open leaf in /admin Section I Reporting (build-checklist #119): CSV /
JSON export for the seven I.1 reports, with PII redaction governed by a
per-export modal Kevin sees every time he clicks Export. Kevin picks
redact-or-raw at click-time; never persisted as a preference, never silent.

Locked decision this chat (Kevin, Chat #144):
**Modal every export — Kevin picks redact/raw each time.**

---

## What "PII" means here

The seven I.1 reports include the following identifying fields. Redaction
applies to these fields and only these:

- `prospectFirstName` / `prospectLastName` → first initial + last initial
  ("M. T.")
- `phone` (E.164) → last-four-digit mask ("+1 ✱✱✱✱✱✱ 1234")
- `email` → first-char + domain mask ("m✱✱✱@example.com")
- `city` → kept (granularity is state-level once anonymized; city is fine)
- `prospectId`, `tokenId` → kept (opaque ids, not PII on their own)
- `sponsorBaId` / `sponsorFullName` — BA names are NOT redacted; BAs are
  Team Magnificent members, not third-party PII

When Kevin picks "raw" the rows export verbatim. When Kevin picks
"redacted" the seven fields above pass through the redactor.

Every export (raw OR redacted) appends a single audit entry with the
redaction choice recorded — critical/info severity per #140 convention.

---

## Files you own (write here)

- `server/src/services/piiRedact.ts` (NEW — the redaction module; pure
  functions, no I/O, fully unit-testable)
- `server/src/domain/reports/export.ts` (NEW — takes a report key + the
  resolved report result + the redaction choice, returns a CSV string
  buffer ready for Express to stream)
- `apps/admin/src/components/admin/reports/ExportPanel.tsx` (NEW — the
  Export button + modal launcher, lives on the reporting page)
- `apps/admin/src/components/admin/reports/RedactionModal.tsx` (NEW — two
  options: "Export Redacted" (default-focused) and "Export Raw", plus a
  Cancel; explains the trade in one short sentence)
- `apps/admin/src/routes/reports.tsx` (CREATE OR EXTEND — a reporting page
  may not exist yet; if it doesn't, scaffold it minimally and mount the
  ExportPanel. If it exists, mount the ExportPanel additively.)
- `apps/admin/src/App.tsx` (EXTEND if reports route is new — additive only)

## Files you APPEND TO (append routes only, do NOT rewrite)

- `server/src/routes/admin/reporting.ts` — add 7 export routes:
  `GET /api/admin/reporting/<key>/export?format=csv&redact=true|false`
  for each of the 7 report keys. Imports go in the import block at the top;
  route definitions go at the bottom before the router export. No edits
  to existing routes.

## Files you read but never write

- `packages/shared/src/reporting.ts` — the 7 report result types
- `server/src/domain/reports/*.ts` — the 7 domain fns
- `server/src/services/pdfReport.ts` — not used (CSV only this round)
- `server/src/domain/auditLog.ts` — `appendAuditEntry`

## Files you MUST NOT touch

- `CLAUDE.md`, `docs/locked-spec.md`, `docs/project-wireframe.md`,
  `docs/build-checklist.html`
- `packages/shared/src/admin-live-ops.ts` (H's contract)
- `apps/admin/src/routes/live-ops.tsx` or `components/admin/live-ops/*`
  (H-UI's turf)
- `server/src/routes/admin/liveOps.ts` (H-server's turf)
- Any of the 7 existing report domain fns under `server/src/domain/reports/`
  — you consume them, you do not edit them

---

## Acceptance criteria (verify before you claim done)

1. `pnpm --filter @momentum/server typecheck` exits 0
2. `pnpm --filter @momentum/admin typecheck` exits 0
3. `pnpm -r typecheck` exits 0
4. Each of the 7 export endpoints returns a CSV body, content-type
   `text/csv; charset=utf-8`, content-disposition
   `attachment; filename="<reportKey>-<timestamp>.csv"`
5. `redact=true` masks the 4 PII fields (firstName, lastName, phone, email)
   on every row; `redact=false` returns them raw. Verify by manual diff
   between two pulls of the same report.
6. The Export button shows the modal; the modal returns Kevin's choice;
   the choice is sent to the server as a query param; the server records
   the choice in the audit entry.
7. Audit entry per export contains: `actor` (Kevin's BA id), `action`
   `'admin.report_export'`, `entity` the report key, `metadata.redact`
   the boolean, `metadata.rowCount` the row count. Severity `info`.

---

## Reference reading order

1. `packages/shared/src/reporting.ts` — all the report shapes
2. `server/src/routes/admin/reporting.ts` — the file you append to;
   read it carefully so your additions match the established patterns
   (the `parseFilter` helper, the `resolveTimeRange` helper, the audit
   block at the end of each route)
3. `server/src/domain/adminMasterReport.ts` — how the PDF surface
   consumes the same domain fns; you do the same with CSV instead
4. `docs/locked-spec.md` §3.17 — the PII context (phone E.164, the
   prospect data we collect)

When anything is ambiguous, **STOP and tell Kevin**. Do not invent the
redaction format for fields not listed above.
