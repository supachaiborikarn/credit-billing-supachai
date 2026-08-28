# S81 pass 6 - write-safe UAT readiness

Date: 2026-08-28
Branch: redesign/ux-v2
Base: 28fc0eb

## Findings
- Local Prisma has only one normal `DATABASE_URL`; there is no existing `.env.test` or CreditBilling test database.
- The normal local URL points to the existing Neon CreditBilling endpoint in `us-west-2`, so write-flow UAT must not use it.
- Neon CLI 4.10.2 is authenticated on the Mac, but the visible organization only exposes `oil-seve` and `timetrack` projects in `aws-ap-southeast-1`; it does not expose the current CreditBilling project. No attempt was made to bypass account/project permissions.
- The old generic `prisma/seed.ts` is not suitable as a write-UAT seed because it covers station 1-4 and optionally imports external CSV data.

## Changes
- Added `scripts/uat-db-guard.mjs` fail-closed preflight.
- Added `scripts/run-with-uat-db.mjs` so child commands receive `DATABASE_URL=UAT_DATABASE_URL` only after the guard passes.
- Added npm commands `uat:preflight`, `uat:db:push`, and `uat:seed`.
- Added deterministic `prisma/seed-uat.ts` for stations 1-6, isolated UAT users, one test credit customer/truck, station-5 test product inventory and GAS default price.
- Added `tests/uat-db-guard.test.ts` covering missing UAT URL, same-host rejection, confirmation rejection and distinct-host acceptance.
- Added `docs/UAT_WRITE_FLOW.md` with setup/run/write-flow checklist.
- Stopped the CreditBilling dev server on port 3005 because it was still connected to the production-like database and the UI contains write actions. Port 3000 remains untouched/reserved.

## Verification
- `npm run uat:preflight` against the current machine configuration fails closed with exit 2 because no UAT DB is configured.
- Guard + GAS/sale/shift regression: 4 files / 44 tests passed.
- `npx tsc --noEmit` passed.
- targeted ESLint passed.
- `git diff --check` passed.

## Pending
- Provision a separate CreditBilling UAT PostgreSQL/Neon branch and put its URL only in `.env.uat.local`.
- Run `uat:preflight`, `uat:db:push`, `uat:seed`.
- Start CreditBilling on a checked-free non-3000 port via `run-with-uat-db.mjs`.
- Execute actual open -> sale -> close integration UAT on the isolated database.

No push/deploy. No production database write was performed in this pass.

## Financial sanity rerun
- Exact checklist command from `FINANCIAL_REGRESSION_CHECKLIST.md` passed: 16 files / 81 tests.
- This rerun was executed on the current working tree, which also contained separate unstaged Tank Loy auto-print changes from another workstream. Those files were not staged or committed in S81 pass 6.
- Because of that concurrent working-tree state, S80 remains the last clean financial baseline recorded in `FINANCIAL_REGRESSION_CHECKLIST.md`; this result is an additional green sanity check, not a replacement baseline.

## Port guard follow-up
- Added `scripts/start-uat-dev.mjs` and `npm run uat:dev`.
- Defaults to 3005, rejects 3000 unconditionally, checks port availability and never kills an existing process.
- Port regression: guard suite is now 5 tests; combined guard + GAS/sale/shift targeted suite is 4 files / 45 tests passed.
- Explicit simulation with `UAT_PORT=3000` failed closed with exit 2 as required.
