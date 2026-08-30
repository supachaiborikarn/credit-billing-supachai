# S112 — Consolidate GAS reconciliation into Shift Report

- Retired standalone `/admin/gas/reconciliation` to `/admin/gas/reports/shift?view=reconciliation` with bookmark/query preservation.
- Moved reconciliation-only status filter, totals, station visibility, `editShiftId` deep-link, `varianceNote`, validation and preview into Shift Report.
- Kept `/api/v2/gas/admin/reconciliation/[shiftId]` PUT unchanged as the authoritative audited write contract.
- Retired unreferenced reconciliation list GET as ADMIN-guarded 410 with no Prisma/analytics access.
- Targeted parity gate 118/118; final focused gate 92/92; financial gate 101/101; full regression 511/511; TypeScript/scoped ESLint/diff check passed; final production build 127/127.
- First build caught an S112-only shared `useSearchParams` prerender failure on `/billing`; removed that hook from shared shell and kept query state local to GAS admin layout before the final passing build.
- Anonymous runtime smoke: old bookmark 307 to login with canonical target/query; retired list API 401 before auth. No DB write, push or deploy.
- Concurrent Tank Loy auto-print/shared-brain files remain unstaged.
