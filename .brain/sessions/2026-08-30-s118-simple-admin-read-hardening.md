# S118 — SIMPLE admin read hardening

- Kept `/admin/simple`, `/admin/simple/stations`, `/admin/simple/fuel-time`, and `/admin/simple/analytics` because they read real operational/Watchara data; S117 retired only the randomized stock mock.
- Added shared `requireAdminApi` to all four v2 SIMPLE admin read APIs before dataset/Prisma access.
- Added shared SIMPLE admin scope helper: station-2/3/4 only and `days` integer 1-90.
- Fuel/time and analytics reject unrelated station IDs; analytics is SIMPLE-only because no internal FULL caller exists.
- Report math and Watchara merge/source behavior are unchanged.
- Verification: targeted 25/25, financial 101/101, full 558/558, TypeScript/ESLint/diff-check, production build 127/127.
- No DB write, push or deploy. Tank Loy concurrent files were not touched.
