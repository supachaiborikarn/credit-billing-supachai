# S92 — FULL V2 admin-maintenance audit

- HEAD at start: `0f22412`.
- `/station/1/v2` remains required only for ADMIN maintenance while canonical Overview/Sales/Operations/History own normal station work.
- Remaining migration slices: historical price correction; historical meter/photo correction; transaction/slip/receipt maintenance; audit/CSV/daily print.
- Fixed ownership/navigation drift: removed FULL V2 sales fallback for staff and replaced the broken FULL History fallback `/station/1/history` with an ADMIN-only V2 maintenance entry.
- Added `getActiveFullAdminMaintenancePath()` and regression coverage so STAFF never receives the V2 maintenance path from canonical UI helpers.
- Targeted verification: 4 files / 135 tests; TypeScript, ESLint and `git diff --check` passed. Production build passed 127/127 routes.
- No financial/write API, schema, production data, push or deploy.
- Concurrent Tank Loy/shared brain work remains untouched.
