# S117 — SIMPLE stock mock retirement

- Retired `/admin/simple/stock`: it generated tank/current-volume/ordering values with `Math.random()` and there is no production Tank inventory source for retired SIMPLE stations.
- Removed the Stock & Ordering navigation item; UI/bookmarks normalize to `/admin/simple` with query preservation.
- `GET /api/v2/simple/admin/stock` now uses `requireAdminApi` and returns 410 for ADMIN instead of fabricated data.
- Other SIMPLE overview/stations/fuel-time/analytics surfaces remain for separate audit; do not infer they are safe just because this mock route was retired.
- Verification: targeted 90/90, financial 101/101, full 544/544, TypeScript/ESLint/diff-check, production build 127/127.
- No DB write, push or deploy. Tank Loy concurrent files were not touched.
