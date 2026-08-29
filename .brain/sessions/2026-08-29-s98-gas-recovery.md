# S98 — Move GAS meter/gauge recovery into canonical Operations

- Canonical GAS Operations now owns guarded START correction plus standalone END save/retry for 4 meters and 3 tank gauges on the exact current OPEN Shift.
- START edits remain fail-closed under the existing backend baseline lock; ADMIN meter repair after activity still routes to the audited `/admin/gas/meters/[shiftId]/edit` flow. No new unrestricted correction path was added.
- Meter recovery preserves the existing START/END photo URL when no replacement image is selected; new images use the existing shift-scoped meter-photo upload contract. Gauge rewrites likewise preserve any existing photo URL returned by the API.
- `/gas/5|6/meters`, `/gas/5|6/gauge` and older GAS meter bookmarks now normalize to canonical Operations with query/auth preservation. Legacy components remain in-tree as fallback source; LPG supplies and station-5 product inventory remain compatibility surfaces.
- Verification: targeted route/recovery gate 217/217; financial gate 90/90; full regression 407/407; TypeScript and S98-scoped ESLint passed with 0 warnings/errors; production build passed 127/127 routes.
- Isolated write UAT on guarded non-production Neon: station-5 START meter/gauge correction returned 200 before lock, standalone END meter/gauge saves returned 200, subsequent START attempts returned 409 for both, readback matched saved values, and fixture cleanup passed.
- UAT server used port 3005 only and was stopped afterward. Port 3000 was untouched. Concurrent Tank Loy auto-print files/brain hunks remain outside S98 staging. No push, deploy or production DB write.
