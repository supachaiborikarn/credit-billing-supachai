# S95 pass 1 — Historical transaction create safety

Date: 2026-08-29

- Audited V2 historical “add transaction” behavior before migrating the remaining V2 maintenance surface.
- Found missing historical dates could be upserted as OPEN DailyRecord before the request later failed; CLOSED dates already could not create because there was no OPEN shift.
- Added `canCreateStationTransaction()` policy: historical create ADMIN-only, retired STAFF read-only, active STAFF current-day flow unchanged.
- FULL historical create now requires an existing DailyRecord + existing OPEN Shift; it never creates a historical day or shift.
- Direct route/policy gate: 5 files / 29 tests.
- Clean S95-pass1 snapshot: financial 16 files / 89 tests; pass-1 5 files / 29 tests; TypeScript passed.
- UAT: STAFF historical 403; missing day 404 and remains absent; CLOSED day 400; ADMIN existing OPEN historical shift 200 with no extra shift. Created UAT transaction = 5 L @ 31.34 = 156.70.
- One initial STAFF login 500 was confirmed as transient Neon connectivity (`PrismaClientInitializationError`); immediate retry succeeded.
- Production build: 127/127 routes.
- Next: migrate edit/void/slip/receipt + audit/CSV/daily-print into canonical History admin maintenance.
- No production DB write, push or deploy. Port 3005 stopped; port 3000 untouched.
