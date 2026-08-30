# S109 — Retire legacy GAS history admin surface

- Retired `/admin/gas-history` to `/admin/gas/reports/daily`; legacy source retained only as `LegacyGasHistoryAdminPage.tsx`.
- Modern report accepts old `stationId/startDate/endDate` bookmarks; canonical GAS History ADMIN link now targets the v2 report.
- Retired `/api/admin/gas-history` GET/POST/DELETE after caller audit: shared ADMIN guard then 410 replacement paths, no Prisma access or hidden Station creation.
- Safe replacements: read = GAS reports, historical create/edit = `/admin/gas/data-entry`, empty-shift cleanup = `/admin/gas/operations`.
- Verification: targeted 111/111, financial 101/101, full 486/486, TypeScript/scoped ESLint/diff check, production build 127/127.
- UAT preflight passed on separate Neon host; authenticated UAT server was not started because a user-owned dev instance on 3005 holds `.next/dev/lock`. No DB write attempted. Anonymous runtime smoke: legacy UI 307 to normalized login/report target; API 401.
- No push, deploy, production DB write, or change to concurrent Tank Loy auto-print files.
