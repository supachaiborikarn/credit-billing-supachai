# S89 — FULL summary parity + retirement

Date: 2026-08-28
Branch: `redesign/ux-v2`
Base: `1486828`

- Audited `/station/1/new/summary`: final missing parity was CSV export (including payment-type filtering) and historical transfer-proof replacement.
- Added testable FULL summary compatibility helpers for safe Thai CSV output, filter parity, station-scoped transaction URLs, proof replacement and void.
- V2 transaction cards now receive station ID explicitly, allow admin/current permitted users to attach/replace transfer proof, and use the correct `/api/station/[stationId]/transactions/[transactionId]` DELETE route.
- V2 Summary now exports CSV with all legacy columns/totals and payment filter selection.
- Retired FULL legacy summary wrapper to `/station/1/v2`; middleware makes summary/list/record routing explicit and query-preserving.
- Shared retired-SIMPLE summary remains untouched.
- Isolated Neon UAT: proof PUT preserved 10 L / 31.34 / 313.40, void fixture succeeded, summary 307 → V2 200.
- Cloudinary was not polluted with a test upload; upload orchestration is covered by mocked regression and reuses the existing production upload endpoint.
- Final clean S89 snapshot: financial 16 files / 83 tests, compatibility 4 files / 60 tests, TypeScript PASS.
- Production build: 127/127 routes PASS.
- No production DB write, push or deploy.
