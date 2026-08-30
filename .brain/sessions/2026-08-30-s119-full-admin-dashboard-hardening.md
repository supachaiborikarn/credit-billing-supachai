# S119 — FULL admin dashboard/anomaly hardening

- Kept `/admin/full` and `/admin/full/anomalies`: they remain useful executive/anomaly reports for active station-1.
- Added ADMIN guard and real `YYYY-MM-DD` calendar validation to `/api/v2/full/admin/dashboard`.
- Replaced ad-hoc transaction aggregates/server-local date setters/UTC grouping with shared operational-sales + Bangkok date-key facts for day, selected-month-to-date, 30-day trend and fuel breakdown.
- Voided count remains a bounded direct read (`station-1`, selected Bangkok day, non-deleted).
- Fixed client default/presets/date labels to Bangkok-safe behavior and made load failures visible/retryable.
- Initial targeted run failed only from a Vitest hoisted-mock TDZ in the new test; switched mocks to `vi.hoisted()`, then targeted passed.
- Verification: targeted 14/14, financial 101/101, full 563/563, TypeScript/ESLint/diff-check, production build 127/127.
- No DB write, push or deploy. Tank Loy concurrent files were not touched.
