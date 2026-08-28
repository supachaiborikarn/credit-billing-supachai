# S82 — retire retired-SIMPLE shift-history

Date: 2026-08-28
Status: complete

- Audited legacy shift-history parity against canonical Station History.
- Added opener, closer and shift-duration metadata to canonical History; meter start/end/sold evidence was already present.
- Split legacy source so FULL route keeps its legacy component while SIMPLE station-2/3/4 wrapper redirects only those retired stations to canonical History.
- Hid legacy-history fallback on retired canonical stations to avoid circular navigation.
- Regression: 132/132; TypeScript passed; only pre-existing legacy hook warning.
- UAT HTTP smoke: retired station 2/3/4 redirects 307 to canonical History and targets return 200.
- No financial/write behavior changed; no push/deploy/production write.
