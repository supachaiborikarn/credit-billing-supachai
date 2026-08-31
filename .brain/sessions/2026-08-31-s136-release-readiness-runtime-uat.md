# S136 — Final software release-readiness + production-runtime UAT

Date: 2026-08-31
Branch: redesign/ux-v2
Status: complete — automated software release gate PASS.

## Finding
S134 made production builds independent from the workstation's inherited `NODE_ENV=development`, but a final `next start` UAT probe showed production runtime still inherited that invalid value. Release verification also needed an up-to-date post-S135 runtime matrix rather than relying only on the older S97 browser acceptance.

## Change
- Added `scripts/run-next-start.mjs` and changed `npm start` to use it.
- Wrapper resolves Next's JS CLI, forwards CLI args, forces `NODE_ENV=production`, preserves the rest of the environment, streams stdio, and propagates the exit code without shell-specific syntax.
- No application financial/operational formula changed in S136.

## Schema readiness
- UAT preflight: PASS; production and UAT Neon hosts are distinct.
- Read-only Prisma diff UAT -> schema: no difference detected.
- Read-only Prisma diff production -> schema: no difference detected.
- No schema write/push/migration was executed.

## Production-runtime UAT
- Started the existing production build through the UAT DB guard with `npm start -- -p 3006`.
- New start wrapper removed the inherited NODE_ENV warning.
- Authenticated UAT matrix passed 35/35:
  - canonical Today/Customers/Billing/FULL/GAS/admin pages 200 for ADMIN,
  - STAFF station-1/5/6 own context 200 and cross-station 403,
  - legacy bookmarks 307 to canonical destinations,
  - S133/S135 retired APIs 410,
  - invalid gauge date 400 and valid read compatibility 200.
- All test sessions were logged out; direct UAT DB readback found recent S136 session residue = 0.
- No business fixture was created; server 3006 was stopped. User-owned port 3005 process was untouched.

## Final verification
- Targeted start/build/env/UAT guard: 12/12.
- Financial/monthly release gate: 101/101.
- Full regression: 683/683 across 93 files.
- TypeScript, scoped ESLint and diff check passed.
- Production build: 127/127 routes.

## Release disposition
Automated software readiness is PASS. The remaining rollout-day checks require physical hardware: camera upload and Epson TM-m30III 58/80 mm printing. Station-3 receipt printing remains deliberately fail-closed until verified legal/header configuration is available; station-3 frontline activity is already on POS.

## Concurrent-work boundary
Do not stage Tank Loy auto-print files or shared `.brain/changelog.md`, `.brain/index.md`, `.brain/topics/bugs-and-fixes.md`, `.brain/topics/station-types.md` hunks with S136.
