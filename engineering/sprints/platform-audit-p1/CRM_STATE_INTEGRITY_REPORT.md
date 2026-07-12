# CRM State Integrity Report

P1-58 adds a Kevin-only, read-only CRM integrity report at
`GET /api/admin/consistency/crm-integrity` and displays it on `/consistency`.

The bounded scan reports:

- open CRM records without recent change (stuck candidates);
- duplicate CRM records and duplicate active follow-ups;
- CRM and follow-up records whose prospect or paired CRM record is missing;
- owner/sponsor, terminal-state, closed-record, and follow-up projection inconsistencies;
- records whose missing identity makes ownership ambiguous.

The report consumes P1-57 by running its cleanup engine in dry-run mode and
returning the deterministic cleanup preview. It never applies those actions.
Every finding carries `repairPolicy: report_only`.

Safety lock: elapsed time is evidence for reporting only. Age never closes a
CRM record, clears a follow-up, selects a duplicate winner, or repairs an
orphaned or ambiguous record.
