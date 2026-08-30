# S103 — Customer duplicate merge + truck reassignment

## Result
- `/trucks` and `/admin/owners` are retired to canonical `/customers`.
- Customers ADMIN tools now support cross-owner truck reassignment and duplicate-owner merge.
- Owner and Truck edit mutations are ADMIN-only; frontline truck search/create remains available for sale workflows.

## Safe merge contract
- One Prisma interactive transaction moves source Owner relations: Truck, Transaction, Invoice and BillingCollection.
- Transaction ownerId + ownerName become the retained target owner.
- BillingCollection ownerId moves but ownerName snapshot is preserved for historical document fidelity.
- Source legacy currentCredit increments onto target; actual canonical debt remains record-derived.
- Source LINE mapping transfers only when target LINE is empty; two existing LINE mappings return 409.
- Merge creates an Owner MERGE AuditLog, then deletes source Owner.

## UAT finding
- First full-relation merge rolled back with Prisma P2028 because default interactive transaction timeout (5s) expired at owner.delete on Neon UAT.
- Fix: keep merge atomic, no write retry, set bounded maxWait 5s and timeout 20s.
- Rerun passed: STAFF owner/truck edits 403, ADMIN reassign 200, merge 200, 1 truck + 1 transaction + 1 invoice + 1 collection moved, LINE transferred, legacy credit 20+30=50, BillingCollection snapshot preserved, AuditLog present.
- Cleanup: S103 Owner/Truck/Transaction/Invoice/BillingCollection fixture counts all 0; port 3005 stopped and port 3000 untouched.

## Gates
- Targeted 87/87; timeout-specific final route/redirect 68/68.
- Financial 90/90.
- Full 430/430.
- TypeScript / scoped ESLint / diff check passed.
- Production build 127/127 routes.

No push, deploy or production DB write.
