# S94 — FULL meter/photo maintenance migration

Date: 2026-08-29

- Moved FULL ADMIN historical start/end meter and photo correction from `/station/1/v2` to canonical `/stations/station-1/operations`.
- Historical meter correction now requires an existing DailyRecord + explicit Shift; it cannot create historical days/shifts.
- Historical meter-photo upload is ADMIN-only and verifies station/date/Shift binding before Cloudinary.
- Current active FULL STAFF meter entry and current GAS STAFF photo upload remain supported.
- V2 meter tab now routes to canonical Operations; V2 remaining scope is transaction/slip/receipt maintenance plus audit/CSV/daily print.
- Isolated Neon UAT: STAFF historical meter/photo 403; missing history 404; mismatched photo Shift 409; ADMIN meter correction 200; four audit logs; transaction stayed 10 L @ 31.34 = 313.40.
- Clean S94 snapshot: financial 16 files / 87 tests, S94 4 files / 27 tests, TypeScript passed.
- No production DB write, push or deploy. Port 3005 stopped; port 3000 untouched.
- Final targeted ESLint: 0 errors (2 pre-existing V2 hook warnings only).
- Production build on the real working tree: 127/127 routes passed. A second build attempt inside the clean temp snapshot was not a code test because Turbopack rejected the snapshot's external `node_modules` symlink; clean snapshot financial/tests/TypeScript had already passed.
