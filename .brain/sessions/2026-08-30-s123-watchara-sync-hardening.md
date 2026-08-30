# S123 — Watchara integration control-plane and local commit hardening

Date: 2026-08-30
Branch: redesign/ux-v2

## Ownership
`/admin/watchara-dispenser` remains KEEP as the external integration control plane (status/probe/bootstrap/dry-run/sync). It is separate from S122 local Dispenser/Nozzle master data.

## Changes
- status/bootstrap/sync routes use shared `requireAdminApi`.
- status probe accepts only 0/1; sync body types fail closed before service execution.
- Watchara date parser rejects impossible dates and keeps the existing ordered max-31-day window.
- UI default date now follows Asia/Bangkok rather than UTC.
- Bootstrap source upsert + `WATCHARA_DISPENSER_BOOTSTRAP` audit are atomic in a bounded transaction.
- Real sync keeps external fetch outside the local transaction. Once fetched, local landing upserts + source success metadata + `WATCHARA_DISPENSER_SYNC` audit commit/rollback together in a bounded 30s transaction.
- Attempt/failure metadata remains outside the success transaction intentionally so failed attempts are visible.
- Dry-run writes no landing/source data but keeps its operator audit.

## Verification
- Targeted: 20/20.
- Financial + monthly: 101/101.
- Full: 609/609.
- TypeScript/scoped ESLint/diff check: passed.
- Build: 127/127 routes.

## Runtime safety
- No live probe/sync performed.
- Port 3005 remains owned by PID 62675 and `.next/dev/lock`; process was not stopped and no write was sent to it.
- No production write, push or deploy.
- Concurrent Tank Loy/shared brain changes remain unstaged.
