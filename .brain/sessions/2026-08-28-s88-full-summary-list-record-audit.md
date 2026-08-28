# S88 — FULL summary/list/record audit

- FULL `summary` remains KEEP_FULL_ADMIN_COMPAT: V2 lacks CSV export and historical transfer-slip replacement even though edit/void, slip view, receipt/credit print and daily report are present.
- FULL `list` and `record` are redirect-only and already map to V2 in middleware; aligned page wrappers to `/station/[id]/v2`.
- No financial/write API change; no production DB write; no push/deploy.
- Concurrent Tank Loy/shared brain files excluded.
- Verification: 153/153 targeted route tests; TypeScript/ESLint/diff check; production build 127/127 routes passed.
