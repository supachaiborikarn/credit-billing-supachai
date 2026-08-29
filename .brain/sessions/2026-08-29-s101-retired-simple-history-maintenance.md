# S101 — retired SIMPLE summary to canonical History

- Retired `/simple-station/2|3|4/new/summary` to canonical History with query/auth normalization while retaining the old page source as fallback/reference.
- Generalized the audited daily-maintenance surface: retired SIMPLE STAFF gets read/view-proof/58-80 receipt reprint/CSV/daily print only; ADMIN also gets edit/void/proof maintenance + AuditTrail. Historical create remains FULL-only.
- Receipt compatibility remains separate; station-3 printing stays fail-closed until verified legal header data exists.
- Verification: targeted 196/196, financial 90/90, full 421/421, TypeScript/scoped ESLint/diff check, build 127/127.
- Isolated station-2 UAT: STAFF history/read/receipt 200 and edit/void/audit 403; ADMIN history/edit/audit/void 200 with UPDATE/DELETE AuditLog. Temporary user/transaction/audits/sessions cleaned; port 3005 stopped.
- First UAT assertion used raw `recordId` instead of public `entityId`; cleanup ran and rerun passed without business-logic changes. Auto-print hunks excluded. No push/deploy/production DB write.
