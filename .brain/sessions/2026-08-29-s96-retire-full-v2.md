# S96 — Retire FULL V2 to canonical workspace

- Retired FULL classic root `/station/1` to canonical Overview and `/station/1/v2` plus summary/list/record/history aliases to canonical History, preserving query strings and normalizing redirect targets before login.
- Updated dashboard, Today, login, Sidebar, BottomNav and compatibility wrappers so FULL navigation no longer depends on a V2 hop; `/station/1/new/receipt` remains print compatibility.
- Canonical Operations now completes partial FULL opening-meter data in the exact OPEN Shift, reuses saved photos, uploads only missing evidence and ignores legacy zero/no-photo placeholder rows.
- Verification: S96 targeted 183/183; financial gate 90/90; isolated S96-only full suite 396/396 + TypeScript + scoped ESLint 0 errors; real-tree full suite 400/400; production build 127/127 routes with `NODE_ENV=production`; local redirect smoke 4/4 on port 3005.
- Full-repo lint still has 35 pre-existing errors outside S96. Tank Loy auto-print files/brain edits were excluded from staging. No push, deploy or production DB write.
