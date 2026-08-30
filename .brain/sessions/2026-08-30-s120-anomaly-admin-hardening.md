# S120 — Anomaly / Anti-Fraud admin hardening

- Kept three distinct admin surfaces: `/admin/alerts` (variance/stale shift/audit + lock), `/admin/anomalies` (MeterAnomaly per shift/nozzle), `/admin/daily-anomalies` (FULL daily meter-vs-transaction anomalies).
- Detection formulas were deliberately unchanged: meter anomaly WARNING 50% / CRITICAL 100%; daily anomaly WARNING 10L / CRITICAL 50L.
- `/api/admin/alerts` now uses `requireAdminApi`, bounded 1-90 day reads, and atomic conditional CLOSED->LOCKED + LOCK AuditLog in one bounded transaction.
- MeterAnomaly GET/review are ADMIN-only; review is one-shot, conditional, atomic with REVIEW AuditLog, and pending reads include UI-required shift/date/station relation.
- DailyAnomaly GET is now read-only: removed hidden auto-scan writes/cooldown. Explicit POST scan is ADMIN-only, object JSON, days 1-90, configured FULL station(s), Bangkok date keys.
- Alert/anomaly UIs are fail-visible instead of presenting request failure as clean/zero data; audit feed recognizes LOCK/REVIEW and sidebar label is no longer SIMPLE-only.
- Verification: targeted 21/21, financial 101/101, full 583/583, TypeScript/ESLint/diff-check, production build 127/127.
- UAT preflight passed, but authenticated write smoke was skipped because existing PID 62675 owns port 3005 and `.next/dev/lock`; we did not kill or mutate through an unverified DB-target process.
- No production DB write, push or deploy. Tank Loy concurrent files were not touched.
