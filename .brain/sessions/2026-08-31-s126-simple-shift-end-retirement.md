# S126 — Retire legacy SIMPLE shift-end write API

## Finding
The SIMPLE shift-end API still exposed a POST that called `closeFullShift()`, but the remaining callers are legacy components whose operational routes are already retired/normalized.

## Decision
Keep GET for historical/read compatibility. Retire POST so there is no second shift-close write contract outside canonical Operations.

## Verification
- targeted: 223/223
- financial/monthly: 101/101
- full: 618/618
- TypeScript + scoped ESLint + diff check passed
- production build: 127/127

No push, deploy, production DB write, or Tank Loy staging.
