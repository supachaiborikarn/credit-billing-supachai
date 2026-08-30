# S114 — GAS supplies hardening (2026-08-30)

- KEEP `/admin/gas/supplies`; it still owns cross-station cost/gauge/forecast/edit-delete capabilities beyond canonical station Inventory.
- Hardened admin and station-scoped supply date filters to reject invalid/reversed Bangkok ranges; admin unknown/non-GAS station filter now fails closed.
- Malformed JSON now returns 400.
- Wrapped station CREATE and admin CREATE/UPDATE/DELETE `GasSupply` mutation + `AuditLog` in bounded Prisma transactions (`maxWait=5s`, `timeout=20s`), with no write retry.
- ADMIN edit cannot move an existing supply across stations and update/delete refuse rows outside configured GAS stations.
- Verification: targeted 42/42, financial 101/101, full 530/530, TypeScript/scoped ESLint/diff-check passed, production build 127/127.
- No push, deploy or production DB write. Tank Loy concurrent files/shared brain hunks were not staged.
