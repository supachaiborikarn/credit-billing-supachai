# S134 — Release build environment guard

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete.

## Finding
The workstation environment globally exposes `NODE_ENV=development`. A Next production build inherited that value and failed during unrelated prerender work despite successful TypeScript and regression tests. Running the same snapshot with the correct production environment passed, so release verification needed to stop depending on ambient shell state.

## Change
- Added `scripts/run-next-build.mjs`.
- `npm run build` now invokes the wrapper.
- The wrapper resolves `next/dist/bin/next`, spawns it with Node, forces only `NODE_ENV=production`, preserves the rest of `process.env`, streams stdio, and returns the child status.
- It deliberately avoids shell syntax and `shell:true` for Mac/Windows/CI portability.

## Verification
- Targeted build/environment/UAT-guard tests: 10/10.
- Financial/monthly release gate: 101/101.
- Full regression: 674/674 across 91 files.
- TypeScript, scoped ESLint and diff check passed.
- Parent shell printed `NODE_ENV=development`; plain `npm run build` still passed 127/127 routes through the wrapper.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S134.
