# S93 — FULL daily-price maintenance migration

- Start HEAD: `05e9647`.
- Moved existing DailyRecord retail/wholesale correction into canonical Operations for ADMIN.
- Historical `POST /api/station/[id]/daily` is now ADMIN-only; active STAFF still may write today's prices for normal FULL shift opening. Retired-station STAFF is blocked.
- Canonical correction refuses to create a missing historical DailyRecord and explicitly does not recalculate saved transactions.
- Removed the V2 price-settings trigger/modal usage. The old `specialPrice` UI was not migrated because the schema/API never persisted it.
- Clean S93 snapshot: financial 16 files / 85 tests; opening/policy 2 files / 14 tests; TypeScript passed. Production build passed 127/127 routes.
- Isolated Neon UAT on 2026-08-27: STAFF POST 403, ADMIN POST 200, Operations 200; DailyRecord became 30.55/29.55 while transaction remained 10 L × 31.34 = 313.40.
- Remaining V2 slices: meter/photo correction; transaction/slip/receipt + audit/export/print.
- No production DB write, push or deploy. Tank Loy/shared brain concurrent changes untouched.
