# S110 — Retire Gas Control v1 API family

- `/admin/gas-control` normalizes to `/admin/gas`; page redirect remains.
- Caller audit found no internal callers for legacy dashboard/gauge/meters/reports/shifts APIs.
- Old gauge POST hard-coded tank 1 / shift 1 and 7,200 L capacity; old meter PUT bypassed the newer shift/reconciliation workflow. Safe replacements are v2 dashboard/reports/operations, admin data-entry, and audited meter editor.
- Added shared ADMIN-guarded 410 helper; all v1 route methods now return replacement paths and contain no Prisma/cookie-session implementation.
- Verification: targeted 126/126, financial 101/101, full 498/498, TypeScript/scoped ESLint/diff check, production build 127/127.
- Anonymous runtime smoke on existing user dev: old UI 307 to normalized login `/admin/gas`; old dashboard/gauge-write APIs 401. No authenticated UAT or DB write.
- No push/deploy and no concurrent Tank Loy auto-print files staged.
