# S108 — Global admin transaction maintenance hardening

- Date: 2026-08-30
- Branch: redesign/ux-v2
- Decision: KEEP /admin/transactions. It is still the only cross-station edit/void workspace; GAS canonical History lacks transaction-correction parity.
- Read hardening: shared requireAdminApi, Bangkok default/day bounds, malformed-date 400, unknown-station 400.
- Edit hardening: global UI requires 3-200 char reason; optional auditReason is recorded in the existing station transaction UPDATE AuditLog with normalized final fields so other callers remain compatible.
- Gates: targeted 101/101; financial+monthly 101/101; full 476/476; TypeScript/ESLint/diff check pass; production build 127/127.
- Isolated UAT: anonymous 401, STAFF 403, invalid date/station 400, ADMIN list/page/edit 200, exact auditReason persisted; cleanup transaction/audit/users = 0.
- UAT server stopped; port 3000 untouched. No push/deploy/production DB write.
- Tank Loy auto-print/shared-brain concurrent files excluded.
