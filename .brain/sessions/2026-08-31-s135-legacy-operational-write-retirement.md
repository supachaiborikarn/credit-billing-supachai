# S135 — Orphaned legacy operational write retirement

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete.

## Finding
The final mutation sweep found three operational write endpoints with no internal caller: station shift-meter POST, legacy GAS gauge POST, and legacy GAS shift-detail PUT. Their canonical replacements already exist. Keeping the old writers live would preserve unaudited/multi-step mutation behavior and, for shift meters, request-supplied capture identity.

## Change
- Retired `POST /api/station/[id]/shift-meters` after station access with 410; GET remains read compatibility.
- Retired `POST /api/gas-station/[id]/gauge` after GAS station access with 410; canonical replacement is V2 gauge via Operations.
- Retired `PUT /api/gas-station/[id]/shifts/[shiftId]` after GAS station access with 410; canonical replacement is V2 shift close via Operations.
- Made legacy GAS gauge GET truly read-only by removing Station upsert and validating station/date/shift filters.
- Station-bound legacy GAS shift-detail GET to the route station.

## Verification
- Targeted regression: 134/134 across 5 files.
- Financial/monthly release gate: 101/101.
- Full regression: 681/681 across 92 files.
- TypeScript, scoped ESLint and diff check passed.
- Production build: 127/127 routes through S134 build wrapper.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S135.
