# S102 — Owner master data to canonical Customers

## Result
- `/owners` is retired to `/customers` with authenticated and login redirect normalization.
- ADMIN can create a customer from Customers and edit/deactivate customer master data from Customer 360.
- Customer 360 also supports adding a truck and changing the plate while keeping that truck on the same owner.
- STAFF canonical master-data permission is false, so these write controls are not shown.
- `/trucks` and `/admin/owners` stay compatibility surfaces for S103 because cross-owner reassignment and duplicate-owner merge still live there.

## Data contract
- Reuse `/api/owners`, `/api/owners/[id]`, `/api/trucks`, `/api/trucks/[id]`; no new Owner/Truck model or calculation source.
- `OwnerGroupLabels` now includes Prisma's existing `OOY_TRUCK` enum so canonical forms do not silently omit that valid group.
- Owner deactivate remains the existing ADMIN-only soft deactivate (`INACTIVE` + `deletedAt`), preserving historical transactions/documents.

## UAT finding / resilience
- First isolated Customer-list read hit transient Neon P1001 before any fixture write.
- Customers list/detail now reuse `withPrismaReadRetry` for the existing P1001/P2024 policy.
- Rerun: STAFF permission=false, ADMIN=true; `/owners` 307; canonical list/detail 200; create/edit owner, add/edit truck and deactivate all 200; final status INACTIVE.
- Cleanup verified S102 owner=0 and truck=0 in the isolated UAT DB; server 3005 stopped; port 3000 untouched.

## Gates
- Targeted: 81/81.
- Financial: 90/90.
- Full: 424/424.
- TypeScript / scoped ESLint / diff check: pass.
- Production build: 127/127 routes.

No push, deploy or production DB write.
