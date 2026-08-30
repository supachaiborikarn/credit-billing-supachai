# S122 — Dispenser/Nozzle admin hardening

Date: 2026-08-30
Branch: redesign/ux-v2

## Ownership
`/admin/dispensers` is local master data and remains KEEP. It is not the same system as `/admin/watchara-dispenser`, which owns external Watchara sales-source probe/bootstrap/sync. Local nozzle links are still meaningful because `MeterReading.nozzleId` can feed FuelProduct/PriceBook selection in shift reconciliation.

## Changes
- Dispenser/Nozzle mutations are ADMIN-only and only allowed for active canonical stations 1/5/6.
- Station aliases normalize to canonical `station-X` IDs before mutation/audit.
- Retired SIMPLE stations are removed from the active admin selector; historical reads stay under existing station-access policy.
- Added `dispenser-admin-service.ts` with bounded atomic write + AuditLog transactions.
- CREATE/UPDATE/DELETE audits cover Dispenser and Nozzle; dispenser delete also soft-deletes active nozzles atomically.
- Nozzle create/update and nested nozzle create validate active FuelProduct references.
- Mutation bodies reject malformed JSON, bad/overlong codes, invalid arrays and empty updates.
- `/api/fuel-products` is ADMIN-only; repository audit found the Dispenser admin page as its only caller.

## Verification
- Targeted: 31/31.
- Financial + monthly: 101/101.
- Full regression: 600/600.
- TypeScript/scoped ESLint/diff check: passed.
- Production build: 127/127 routes.

## UAT / safety
- UAT preflight passed and UAT Neon is separate from production.
- PID 62675 still owns port 3005 and `.next/dev/lock`; it was not stopped. No authenticated write smoke was sent to an unverified server process.
- No production write, push or deploy.
- Concurrent Tank Loy/shared brain changes remain unstaged.
