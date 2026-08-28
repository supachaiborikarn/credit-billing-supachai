# CreditBilling write-safe UAT

This workflow exists to prevent local UAT writes from reaching the production-like Neon database in `.env.local`.

## Safety rules

- Never run write-flow UAT with the normal `.env.local` database.
- Never use port `3000` for CreditBilling.
- `UAT_DATABASE_URL` must point to a different PostgreSQL host/Neon branch from the production `DATABASE_URL`.
- Every UAT database command must pass `npm run uat:preflight` first.
- `.env.uat.local` is ignored by Git through the existing `.env*` rule. Never commit its credentials.

## 1. Create `.env.uat.local`

```dotenv
UAT_DATABASE_URL="postgresql://...a-separate-uat-host.../neondb?sslmode=require"
UAT_WRITE_ENABLED=YES_I_KNOW_THIS_IS_UAT
UAT_ADMIN_PASSWORD="choose-a-test-only-password"
UAT_STAFF_PASSWORD="choose-a-test-only-password"
```

The guard rejects the configuration when the UAT URL is missing, invalid, identical to production, or uses the same host as production.

## 2. Run preflight

```bash
npm run uat:preflight
```

Expected output starts with:

```text
UAT database preflight: PASS
```

Only host/database names are printed. Credentials are never printed.

## 3. Create schema and deterministic UAT fixtures

Run these only after preflight passes:

```bash
npm run uat:db:push
npm run uat:seed
```

The UAT seed creates only deterministic test fixtures:

- station-1 through station-6
- `uat_admin`
- `uat_station1`, `uat_station5`, `uat_station6`
- one credit customer `UAT-001` and truck `UAT-TEST`
- one station-5 product/inventory fixture
- GAS default price `16.09`

The seed itself has a second safety check and refuses to run unless `DATABASE_URL` has already been replaced with the validated `UAT_DATABASE_URL`.

## 4. Start the app against UAT only

First find a free port. Port `3000` is reserved by another application and must not be touched.

Example check:

```bash
lsof -nP -iTCP:3005 -sTCP:LISTEN
```

Start through the guarded UAT launcher:

```bash
npm run uat:dev
```

It defaults to port `3005`, rejects port `3000` unconditionally, verifies the chosen port is free, and never kills another process. If `3005` is occupied, choose another port explicitly:

```bash
UAT_PORT=3006 npm run uat:dev
```

## 5. Write-flow UAT order

Use the isolated UAT users only.

1. Login and confirm `/api/auth/me` resolves the intended UAT role/station.
2. station-1: open shift -> create one CASH sale -> create one CREDIT sale with `UAT-001` / `UAT-TEST` -> close shift.
3. station-5: open GAS shift with 4 start meters + 3 start gauges -> CASH sale -> CREDIT sale -> end meters/gauges -> close/reconcile shift.
4. station-6: repeat GAS flow and confirm products remain disabled.
5. Verify Today, History, Customers and Billing show only the expected UAT writes.
6. Verify duplicate-sale protection, station permission boundaries and stale-shift behavior.

Do not reuse production customer IDs, production truck IDs, or real bill numbers in the UAT database.

## Current blocker (2026-08-28)

The Neon CLI login currently available on this Mac can access the `oil-seve` and `timetrack` projects, but not the existing CreditBilling Neon project/branch in `us-west-2`. Therefore no branch was created from the live CreditBilling database in S81. A separate UAT database URL must be provisioned intentionally before write-flow UAT starts.
